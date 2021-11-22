// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "./IERC20.sol";

interface IWormhole {
    function gton() external view returns (IERC20);

    function gtonRelic() external view returns (IERC20);

    function wallet() external view returns (IERC20);

    function swap(uint256 amount) external;

    function setOwner(address _owner) external;

    function setWallet(IERC20 _wallet) external;

    function setPrice(uint _priceGton, uint _priceRelic) external;

    /// @notice Event emitted when the owner changes via `#setOwner`.
    /// @param ownerOld The previous owner
    /// @param ownerNew The new owner
    event SetOwner(address indexed ownerOld, address indexed ownerNew);

    /// @notice Event emitted when the wallet changes via `#setWallet`.
    /// @param walletOld The previous wallet
    /// @param walletNew The new wallet
    event SetWallet(address indexed walletOld, address indexed walletNew);

    /// @notice Event emitted when the wallet changes via `#setPrice`.
    /// @param priceGtonNew The new price
    /// @param priceRelicOld The new price
    /// @param priceRelicNew The new price
    event SetPrice(
        uint256 indexed priceGtonNew,
        uint256 indexed priceRelicOld,
        uint256 indexed priceRelicNew
    );

    /// @notice Event emitted when the `sender` claims `amount` of governance tokens
    /// @param sender The account from whose governance balance tokens were claimed
    /// @param receiver The account to which governance tokens were transferred
    /// @dev receiver is always same as sender, kept for compatibility
    /// @param amountLocked The amount of refGton locked
    /// @param amountReceived The amount of gton received
    event Swap(
        address indexed sender,
        address indexed receiver,
        uint256 amountLocked,
        uint256 amountReceived
    );
}
// so we are assuming that we are issuing exact same amount of gton 1each block
// so it means that
