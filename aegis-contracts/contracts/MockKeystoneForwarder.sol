// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReceiver} from "./IReceiver.sol";

/**
 * @title MockKeystoneForwarder
 * @notice Mock implementation of Chainlink CRE Forwarder for testing
 * @dev Simulates the Chainlink Forwarder's behavior of calling onReport
 *      on receiver contracts. Used for local testing without real CRE infrastructure.
 */
contract MockKeystoneForwarder {
    // ============ Events ============

    event ReportDelivered(
        address indexed receiver,
        bytes32 workflowExecutionId,
        bool success
    );

    // ============ Errors ============

    error ReportDeliveryFailed(address receiver, bytes returnData);

    // ============ State ============

    uint256 public reportCount;

    // ============ Core Functions ============

    /**
     * @notice Deliver a report to a receiver contract
     * @param receiver The target receiver contract
     * @param metadata Workflow metadata (can be empty for testing)
     * @param report The actual report data to deliver
     * @return success Whether the delivery succeeded
     */
    function deliverReport(
        address receiver,
        bytes calldata metadata,
        bytes calldata report
    ) external returns (bool success) {
        bytes32 workflowExecutionId = keccak256(abi.encodePacked(
            block.timestamp,
            reportCount++,
            receiver,
            report
        ));

        // Call onReport on the receiver
        try IReceiver(receiver).onReport(metadata, report) {
            success = true;
            emit ReportDelivered(receiver, workflowExecutionId, true);
        } catch (bytes memory returnData) {
            emit ReportDelivered(receiver, workflowExecutionId, false);
            revert ReportDeliveryFailed(receiver, returnData);
        }
    }

    /**
     * @notice Deliver a report without metadata (simpler interface)
     * @param receiver The target receiver contract
     * @param report The report data to deliver
     */
    function deliverReportSimple(
        address receiver,
        bytes calldata report
    ) external returns (bool success) {
        // Empty metadata for simple testing
        bytes memory emptyMetadata = "";

        try IReceiver(receiver).onReport(emptyMetadata, report) {
            success = true;
            emit ReportDelivered(receiver, bytes32(reportCount++), true);
        } catch (bytes memory returnData) {
            emit ReportDelivered(receiver, bytes32(reportCount), false);
            revert ReportDeliveryFailed(receiver, returnData);
        }
    }
}
