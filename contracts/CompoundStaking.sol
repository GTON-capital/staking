// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract CompoundStaking {
    struct UserInfo {
        uint share;
        uint tokenAtLastUserAction;
        uint rewardDebt;
    }

    struct UserUnlock {
        uint delta;
        uint amount;
        uint startBlock;
    }

    IERC20 public immutable token;
    mapping (address => UserUnlock[]) public userUnlock;
    mapping(address => UserInfo) public userInfo;

    uint256 public totalShares;
    address public owner;
    uint public blocksInYear;
    uint public apyUp;
    uint public apyDown;
    uint public potentiallyMinted;
    uint public lastRewardBlock;
    uint public requiredBalance;
    bool public revertFlag;

    constructor(
        IERC20 _token,
        uint _blocksInYear
    ) {
        token = _token;
        blocksInYear = _blocksInYear;
        lastRewardBlock = block.number;
    }

    modifier notReverted() {
        require(!revertFlag, "owner: wut?");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner: wut?");
        _;
    }

    function createTimeUnlock(uint _delta, uint _amount, address _for) public {
        updateRewardPool();
        require(_amount > 0, "Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");
        uint256 currentShares = 0;
        if (totalShares != 0) {
            currentShares = _amount * totalShares / requiredBalance;
        } else {
            currentShares = _amount;
        }
        UserUnlock[] storage userUn = userUnlock[_for];
        userUn.push( UserUnlock({
            delta: _delta,
            amount: currentShares,
            startBlock: block.number
        }));

        totalShares += currentShares;
        requiredBalance += _amount;
    }

    function updateRewardPool() public {
        uint tokenPerBlock = apyUp * requiredBalance / apyDown / blocksInYear;
        uint delta = block.number - lastRewardBlock;
        uint potentialMint = delta * tokenPerBlock;
        potentiallyMinted += potentialMint;
        requiredBalance += potentialMint;
        lastRewardBlock = block.number;
    }

    // TODO: array of oracles midifyer + owner
    function setApy(uint _apyUp, uint _apyDown) public {
        apyUp = _apyUp;
        apyDown = _apyDown;
    }

    // TODO: array of oracles midifyer
    function setBlocksInYear(uint _blocksInYear) public onlyOwner {
        updateRewardPool();
        blocksInYear = _blocksInYear;
    }

    function toggleRevert() public onlyOwner {
        revertFlag = !revertFlag;
    }

    function withdrawToken(IERC20 _token, address _to, uint _amount) public onlyOwner {
            require(_token.transfer(_to,_amount));
    }

    function deposit(uint _amount) external {
        updateRewardPool();
        require(_amount > 0, "Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");
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

    function withdrawAll() public {
        withdraw(userInfo[msg.sender].share);
    }

    function balanceOf(address _user) public view returns(uint) { 
        return pendingReward(_user);
    }

    function pendingReward(address _user) public view returns(uint) {
        uint totalAmount = 0;
        uint totalCurrent = 0;

        UserInfo memory user = userInfo[msg.sender];
        UserUnlock[] memory userUn = userUnlock[msg.sender];
        for(uint i = 0; i < userUn.length;i++) {
            totalCurrent = userUn[i].delta * (block.number - userUn[i].startBlock) / userUn[i].amount;
            totalAmount += userUn[i].amount;
        }
        return(userInfo[_user].share + totalCurrent - user.rewardDebt) * requiredBalance / totalShares;
    }

    function moveUnlocked(address _user) public {
        uint totalAmount = 0;
        uint totalCurrent = 0;

        UserInfo storage user = userInfo[_user];
        UserUnlock[] storage userUn = userUnlock[_user];
        for(uint i = 0; i < userUn.length;i++) {
            totalCurrent = userUn[i].delta * (block.number - userUn[i].startBlock) / userUn[i].amount;
            totalAmount += userUn[i].amount;
            i++;
        }
        user.share += (totalCurrent - user.rewardDebt);
        user.rewardDebt = totalCurrent;

        for(uint i = userUn.length; i >= 0;) {
            if (block.number >= userUn[i].startBlock + userUn[i].delta && user.rewardDebt >= userUn[i].amount) {
                user.rewardDebt -= userUn[i].amount;
                userUn.pop();
            }  else {
                i--;
            }
        }
    }

    function withdraw(uint256 _share) public {
        updateRewardPool();
        moveUnlocked(msg.sender);

        UserInfo storage user = userInfo[msg.sender];
        require(_share <= user.share, "Withdraw amount exceeds balance");
        uint256 currentAmount = requiredBalance * _share / totalShares;
    
        user.share -= _share;
        totalShares -= _share;
        requiredBalance -= currentAmount;
        require(token.transfer(msg.sender,currentAmount),"not enough token to transfer");
    }
}