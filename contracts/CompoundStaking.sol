// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract CompoundStaking {

    address public owner;
    bool public revertFlag;
    uint public totalShares;
    uint public tokenPerBlock;
    uint public potentiallyMinted;
    uint public lastRewardBlock;
    uint public requiredBalance;

    IERC20 public immutable token;

    struct UserInfo {
        uint share;
        uint tokenAtLastUserAction;
    }

    mapping(address => UserInfo) public userInfo;

    constructor(
        IERC20 _token,
        uint _tokenPerBlock
    ) {
        owner = msg.sender;
        token = _token;
        tokenPerBlock = _tokenPerBlock;
        lastRewardBlock = block.number;
    }

    modifier notReverted() {
        require(!revertFlag, "Compound: reverted flag on.");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Compound: permitted to owner only.");
        _;
    }

    function transferOwnership(address _owner) public onlyOwner {
        address oldOwner = owner;
        owner = _owner;
        emit SetOwner(oldOwner, _owner);
    }

    function toggleRevert() public onlyOwner {
        revertFlag = !revertFlag;
        emit RevertFlag(revertFlag);
    }

    function setTokenPerBlock(uint _tokenPerBlock) public onlyOwner {
        updateRewardPool();
        tokenPerBlock = _tokenPerBlock;
    }

    function withdrawToken(IERC20 _token, address _to, uint _amount) public onlyOwner {
        require(_token.transfer(_to,_amount));
    }

    function pendingReward(address _user) public view returns(uint) {
        return userInfo[_user].share * requiredBalance / totalShares;
    }

    function updateRewardPool() public {
        uint delta = block.number - lastRewardBlock;
        uint potentialMint = delta * tokenPerBlock;
        potentiallyMinted += potentialMint;
        requiredBalance += potentialMint;
        lastRewardBlock = block.number;
    }

    function deposit(uint _amount) external {
        updateRewardPool();
        require(_amount > 0, "Compound: Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"Compound: insufficient approve");
        uint256 currentShares = 0;
        if (totalShares != 0) {
            currentShares = _amount * totalShares / requiredBalance;
        } else {
            currentShares = _amount;
        }
        UserInfo storage user = userInfo[msg.sender];
        user.share += currentShares;
        totalShares += currentShares;
        requiredBalance += _amount;
    }

    function withdraw(uint256 _share) public {
        updateRewardPool();
        UserInfo storage user = userInfo[msg.sender];
        require(_share > 0, "Compound: Nothing to withdraw");
        require(_share <= user.share, "Compound: Withdraw amount exceeds balance");

        uint256 currentAmount = requiredBalance * _share / totalShares;
        user.share = user.share - _share;
        totalShares = totalShares - _share;

        requiredBalance -= currentAmount;
        require(token.transfer(msg.sender,currentAmount),"Compound: Token transfer error.");
    }

    function withdrawAll() public {
        withdraw(userInfo[msg.sender].share);
    }

    event RevertFlag(bool flag);
    event SetOwner(address oldOwner, address newOwner);
}