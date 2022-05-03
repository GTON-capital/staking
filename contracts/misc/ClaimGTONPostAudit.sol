// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "../interfaces/InitializableOwnable.sol";
import "./PreAuditStaking.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ClaimGTONPostAudit is InitializableOwnable, ReentrancyGuard {

    /* ========== CONSTANTS ========== */
    // Testnet - 0x314650ac2876c6B6f354499362Df8B4DC95E4750
    // Fantom  - 0xB0dAAb4eb0C23aFFaA5c9943d6f361b51479ac48
    PreAuditStaking public immutable stakingContract;
    IERC20 public immutable gton;

    uint public constant pauseTimestamp = 1651595669;

    uint public constant calcDecimals = 1e14;
    uint public constant secondsInYear = 31557600;
    uint public constant aprDenominator = 10000;
    uint public constant aprBasisPoints = 2232;
    uint public lastRewardTimestamp = 1651590675;
    uint public accumulatedRewardPerShare;
    
    /* ========== STATE VARIABLES ========== */
    mapping(address => bool) public withdrawals;

    constructor(
        PreAuditStaking stakingContract_,
        IERC20 gton_
    ) {
        stakingContract = stakingContract_;
        gton = gton_;
        require(lastRewardTimestamp > stakingContract_.lastRewardTimestamp(), "Wrong update timestamp");
        uint timeDelta = lastRewardTimestamp - stakingContract_.lastRewardTimestamp();
        uint rewardDelta = (timeDelta * aprBasisPoints * calcDecimals) / (aprDenominator * secondsInYear);
        accumulatedRewardPerShare = 
            stakingContract_.accumulatedRewardPerShare() + rewardDelta;
    }

    function withdrawGton() public nonReentrant {
        require(withdrawals[msg.sender] == false, "User already withdrawn");
        require(stakingContract.balanceOf(msg.sender) != 0, "Zero balance");
        PreAuditStaking.UserInfo memory user = stakingContract.userInfo(msg.sender);
        // user.lastHarvestTimestamp = block.timestamp;
        uint pendingReward = accumulatedRewardPerShare * user.amount / calcDecimals;
        uint accumulatedReward = user.accumulatedReward + pendingReward - user.rewardDebt;
        uint amount = user.amount + accumulatedReward;

        withdrawals[msg.sender] = true;
        require(gton.transfer(msg.sender, amount), "Staking: transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    event Withdraw(address indexed user, uint indexed amount);
}
