// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

interface PreAuditStaking {

    /* ========== HELPER STRUCTURES ========== */

    struct UserInfo {
        uint amount;
        uint rewardDebt;
        uint accumulatedReward;
        uint lastHarvestTimestamp;
    }

    /* ========== STATE VARIABLES ========== */

    function accumulatedRewardPerShare() external view returns(uint);
    function lastRewardTimestamp() external view returns(uint);
    function userInfo(address address_) external view returns(UserInfo memory);
    function balanceOf(address user_) external view returns(uint);
}
