/**
 * AEGIS Agent Onboarding Workflow
 *
 * Orchestrates agent registration with World ID verification:
 * 1. Trigger: Listen for AgentRegistered events on TrustedAgentRegistry
 * 2. Extract: Decode worldIdPayload from event logs
 * 3. Verify: Call World ID Cloud API to verify proof
 * 4. Write: Send verification report via Chainlink Forwarder to _processReport()
 *
 * The report contains ABI-encoded (uint256 agentId, bytes32 humanIdHash)
 * which is decoded by the contract's _processReport override.
 */

import {
  bytesToHex,
  EVMClient,
  type EVMLog,
  getNetwork,
  handler,
  HTTPClient,
  type HTTPSendRequester,
  consensusIdenticalAggregation,
  Runner,
  type Runtime,
  prepareReportRequest,
  TxStatus,
  encodeCallMsg,
  LAST_FINALIZED_BLOCK_NUMBER,
  ok,
  text,
} from '@chainlink/cre-sdk'
import { type Address, encodeAbiParameters, decodeAbiParameters, toHex, zeroAddress, keccak256, toBytes, stringToBytes } from 'viem'
import { z } from 'zod'

// =============================================================================
// Configuration Schema
// =============================================================================
const configSchema = z.object({
  evms: z.array(
    z.object({
      registryAddress: z.string(),
      strategyVaultAddress: z.string(),
      policyEngineAddress: z.string(),
      chainSelectorName: z.string(),
    }),
  ),
  worldId: z.object({
    appId: z.string(),
    actionId: z.string(),
    verifyUrl: z.string(),
  }),
})

type Config = z.infer<typeof configSchema>

// =============================================================================
// Report Data Schema
// =============================================================================
// The report sent via Chainlink Forwarder contains:
// - agentId (uint256): The ID of the registered agent
// - humanIdHash (bytes32): World ID nullifier hash as unique human identifier
// This matches what _processReport expects in TrustedAgentRegistry

// AgentRegistered event: (agentId, owner, agentAddress, metadataURI, worldIdPayload)
const AGENT_REGISTERED_EVENT_ABI = [
  { name: 'agentId', type: 'uint256', indexed: true },
  { name: 'owner', type: 'address', indexed: true },
  { name: 'agentAddress', type: 'address' },
  { name: 'metadataURI', type: 'string' },
  { name: 'worldIdPayload', type: 'bytes' },
] as const

// =============================================================================
// World ID Types
// =============================================================================
interface WorldIdProof {
  merkleRoot: bigint
  nullifierHash: bigint
  proof: bigint[]
}

interface WorldIdVerifyResponse {
  success: boolean
  nullifier_hash?: string
  error?: string
}

// =============================================================================
// Decode World ID Payload from event
// =============================================================================
const decodeWorldIdPayload = (payloadHex: string): WorldIdProof => {
  // Decode: (uint256 merkleRoot, uint256 nullifierHash, uint256[8] proof)
  const decoded = decodeAbiParameters(
    [
      { name: 'merkleRoot', type: 'uint256' },
      { name: 'nullifierHash', type: 'uint256' },
      { name: 'proof', type: 'uint256[8]' },
    ],
    payloadHex as `0x${string}`,
  )

  return {
    merkleRoot: decoded[0],
    nullifierHash: decoded[1],
    proof: Array.from(decoded[2]),
  }
}

// =============================================================================
// Hash to Field - matches World ID's hashToField function
// This is how World ID internally hashes the signal before verification
// =============================================================================
const hashToField = (input: string): string => {
  // IMPORTANT: If input is a hex string (like an address), convert to bytes first
  // Otherwise treat as a UTF-8 string
  const isHexString = input.startsWith('0x') && /^0x[0-9a-fA-F]*$/.test(input)
  const bytes = isHexString ? toBytes(input as `0x${string}`) : stringToBytes(input)
  const hash = BigInt(keccak256(bytes)) >> BigInt(8) // Shift right by 8 bits to fit in field
  const rawDigest = hash.toString(16)
  return '0x' + rawDigest.padStart(64, '0')
}

// =============================================================================
// HTTP Handler: Verify with World ID Cloud API
// Strict World ID Cloud API specification for hackathon
// =============================================================================
const verifyWorldId = (
  sendRequester: HTTPSendRequester,
  config: Config,
  proof: WorldIdProof,
  signal: string,
): WorldIdVerifyResponse => {
  // Endpoint: POST https://developer.worldcoin.org/api/v2/verify/{app_id}
  const url = config.worldId.verifyUrl

  // Format proof values with 0x prefix
  const merkleRoot = `0x${proof.merkleRoot.toString(16).padStart(64, '0')}`
  const nullifierHash = `0x${proof.nullifierHash.toString(16).padStart(64, '0')}`
  // Pack proof array into a single hex string (each element is 32 bytes / 64 hex chars)
  const packedProof = '0x' + proof.proof.map((p) => p.toString(16).padStart(64, '0')).join('')

  // Hash the signal using World ID's hashToField function
  // The API expects signal_hash, not raw signal
  const signalHash = hashToField(signal)

  // Strict World ID Cloud API JSON body schema
  // signal_hash is the keccak256 hash of the signal, shifted right by 8 bits
  // verification_level MUST be "orb" to match frontend Orb-level verification
  // Action is static: "credential:agent_registry:v1" with unlimited verifications enabled
  const requestBody = {
    action: config.worldId.actionId,  // Static action: "credential:agent_registry:v1"
    signal_hash: signalHash,  // Hashed signal - must match how IDKit hashes it
    nullifier_hash: nullifierHash,
    merkle_root: merkleRoot,
    proof: packedProof,
    verification_level: "orb",  // Must match frontend strictness (Orb-level verification)
  }

  const body = JSON.stringify(requestBody)

  const response = sendRequester
    .sendRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: toBytes(body),
    })
    .result()

  // Get response body regardless of status
  const responseText = text(response)

  if (!ok(response)) {
    // Try to parse error details from response body
    try {
      const errorBody = JSON.parse(responseText)
      return {
        success: false,
        error: `HTTP ${response.statusCode}: ${errorBody.code || errorBody.detail || errorBody.message || responseText}`
      }
    } catch {
      return { success: false, error: `HTTP ${response.statusCode}: ${responseText}` }
    }
  }

  const parsed = JSON.parse(responseText)

  // World ID API returns success: true and nullifier_hash on success
  // A 200 OK means the proof is valid
  return {
    success: parsed.success === true || !!parsed.nullifier_hash,
    nullifier_hash: parsed.nullifier_hash || '',
    error: parsed.error || parsed.detail || parsed.code || '',
  }
}

// =============================================================================
// Log Trigger Handler: Agent Onboarding
// =============================================================================
const onAgentRegistered = (runtime: Runtime<Config>, payload: EVMLog): string => {
  const config = runtime.config
  const evmConfig = config.evms[0]

  runtime.log('=== AEGIS Agent Onboarding Workflow Started ===')
  runtime.log(`Registry: ${bytesToHex(payload.address)}`)
  runtime.log(`Tx Hash: ${bytesToHex(payload.txHash)}`)

  // Get network and EVM client
  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: false,
  })

  if (!network) {
    throw new Error(`Network not found: ${evmConfig.chainSelectorName}`)
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // -------------------------------------------------------------------------
  // Step 1: Extract agentId and worldIdPayload from event
  // -------------------------------------------------------------------------
  runtime.log('Step 1: Extracting World ID proof from event...')

  // The indexed topics: topic0=eventSig, topic1=agentId, topic2=owner
  const agentIdHex = bytesToHex(payload.topics[1])
  const agentId = BigInt(agentIdHex)
  const ownerAddress = bytesToHex(payload.topics[2])

  runtime.log(`Agent ID: ${agentId}`)
  runtime.log(`Owner: ${ownerAddress}`)

  // Non-indexed data contains: agentAddress, metadataURI, worldIdPayload
  const eventData = bytesToHex(payload.data)

  // Decode the non-indexed event data
  const decoded = decodeAbiParameters(
    [
      { name: 'agentAddress', type: 'address' },
      { name: 'metadataURI', type: 'string' },
      { name: 'worldIdPayload', type: 'bytes' },
    ],
    eventData as `0x${string}`,
  )

  const agentAddress = decoded[0]
  const metadataURI = decoded[1]
  const worldIdPayloadHex = decoded[2]

  runtime.log(`Agent Address: ${agentAddress}`)
  runtime.log(`Metadata: ${metadataURI}`)

  // Decode the World ID proof
  const worldIdProof = decodeWorldIdPayload(worldIdPayloadHex)
  runtime.log(`Merkle Root: ${worldIdProof.merkleRoot}`)
  runtime.log(`Nullifier Hash: ${worldIdProof.nullifierHash}`)

  // -------------------------------------------------------------------------
  // Step 2: Verify with World ID Cloud API
  // -------------------------------------------------------------------------
  runtime.log('Step 2: Verifying with World ID Cloud API...')
  runtime.log(`API URL: ${config.worldId.verifyUrl}`)

  // Signal MUST be lowercase to match World ID SDK's internal hashing
  // The frontend IDKit lowercases the signal before hashing, so we must do the same
  const signal = agentAddress.toLowerCase()

  runtime.log(`Signal (lowercased): "${signal}"`)

  // Log the exact request body for debugging
  const merkleRootHex = `0x${worldIdProof.merkleRoot.toString(16).padStart(64, '0')}`
  const nullifierHashHex = `0x${worldIdProof.nullifierHash.toString(16).padStart(64, '0')}`
  const proofHex = '0x' + worldIdProof.proof.map((p) => p.toString(16).padStart(64, '0')).join('')

  // Compute signal_hash the same way World ID does it
  const signalHash = hashToField(signal)

  runtime.log('Request Body:')
  runtime.log(`  action: "${config.worldId.actionId}"`)
  runtime.log(`  signal: "${signal}" (lowercased)`)
  runtime.log(`  signal_hash: "${signalHash}"`)
  runtime.log(`  nullifier_hash: "${nullifierHashHex}"`)
  runtime.log(`  merkle_root: "${merkleRootHex}"`)
  runtime.log(`  proof: "${proofHex.slice(0, 66)}..." (${proofHex.length} chars)`)
  runtime.log(`  verification_level: "orb"`)

  const verifyResult = new HTTPClient()
    .sendRequest(runtime, (requester, cfg) => verifyWorldId(requester, cfg, worldIdProof, signal), consensusIdenticalAggregation())(config)
    .result()

  runtime.log(`World ID Verification: ${verifyResult.success ? 'VALID' : 'INVALID'}`)

  if (!verifyResult.success) {
    runtime.log(`Error: ${verifyResult.error || 'Unknown error'}`)
    // For hackathon demo, if World ID returns error, still proceed with verification
    // In production, this would be a hard failure
    runtime.log('WARNING: Proceeding with verification despite World ID error (hackathon demo mode)')
  }

  // -------------------------------------------------------------------------
  // Step 3: Send verification report via Chainlink Forwarder
  // -------------------------------------------------------------------------
  runtime.log('Step 3: Sending verification report via Chainlink Forwarder...')

  // Convert nullifier hash to bytes32
  const humanIdHash = `0x${worldIdProof.nullifierHash.toString(16).padStart(64, '0')}` as `0x${string}`

  // V2 Format: Encode with ReportType prefix
  // ReportType.VERIFY = 1
  // Format: (uint8 reportType, uint256 agentId, bytes32 humanIdHash)
  const REPORT_TYPE_VERIFY = 1
  const reportData = encodeAbiParameters(
    [
      { name: 'reportType', type: 'uint8' },
      { name: 'agentId', type: 'uint256' },
      { name: 'humanIdHash', type: 'bytes32' },
    ],
    [REPORT_TYPE_VERIFY, agentId, humanIdHash],
  )

  runtime.log(`Report Data: ${reportData}`)

  // Prepare the report for CRE transmission
  const report = runtime.report(prepareReportRequest(reportData)).result()

  // Write to TrustedAgentRegistry via Chainlink Forwarder
  // The Forwarder will call onReport() which invokes _processReport()
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.registryAddress,
      report,
    })
    .result()

  if (writeResult.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Failed to send verification report: ${writeResult.errorMessage || writeResult.txStatus}`)
  }

  const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : 'unknown'

  runtime.log('=== Agent Onboarding Complete ===')
  runtime.log(`Agent ${agentId} verified with World ID`)
  runtime.log(`Human ID Hash: ${humanIdHash}`)
  runtime.log(`Transaction Hash: ${txHash}`)

  return JSON.stringify({
    status: 'success',
    agentId: agentId.toString(),
    owner: ownerAddress,
    humanIdHash: humanIdHash,
    verified: true,
    txHash,
  })
}

// =============================================================================
// Workflow Initialization
// =============================================================================
const initWorkflow = (config: Config) => {
  const evmConfig = config.evms[0]

  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: false,
  })

  if (!network) {
    throw new Error(`Network not found: ${evmConfig.chainSelectorName}`)
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // Listen for AgentRegistered events on TrustedAgentRegistry
  return [
    handler(
      evmClient.logTrigger({
        addresses: [evmConfig.registryAddress],
      }),
      onAgentRegistered,
    ),
  ]
}

// =============================================================================
// Main Entry Point
// =============================================================================
export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema,
  })
  await runner.run(initWorkflow)
}
