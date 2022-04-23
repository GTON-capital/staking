// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IStaking is IERC20, IERC20Metadata {

     /* ========== CONSTANTS ========== */

    function calcDecimals() external view returns (uint);

    function secondsInYear() external view returns (uint);

    function aprDenominator() external view returns (uint);

    /* ========== STATE VARIABLES ========== */

    function aprBasisPoints() external view returns (uint);

    /* ========== MUTATIVE FUNCTIONS ========== */

    function updateRewardPool() external;

    function stake(uint amount, address to) external;

    function harvest(uint256 amount) external;

    function unstake(address to, uint256 amount) external;

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setApr(uint _aprBasisPoints) external;

    function togglePause() external;

    function withdrawToken(IERC20 tokenToWithdraw, address to, uint amount) external;

    function updateAdmin(address _admin) external;

    /* ========== EVENTS ========== */

    event Pause(bool flag);
    event SetAdmin(address oldAdmin, address newAdmin);
    event SetApr(uint oldBasisPoints, uint newBasisPoints);
}
