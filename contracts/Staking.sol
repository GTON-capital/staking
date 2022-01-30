// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract Staking is IERC20, IERC20Metadata {

    uint public calcDecimals = 1e12;
    uint public secondsInYear = 31557600;
    uint public aprDenominator = 10000;
    string public name;
    string public symbol;

    address public admin;

    bool public paused;
    uint public lastRewardTimestamp;

    uint public accumulatedRewardPerShare;
    uint public amountStaked;
    uint public harvestInterval;
    uint public aprBasisPoints;

    uint8 public decimals;

    struct UserInfo {
        uint amount;
        uint rewardDebt;
        uint accumulatedReward;
        uint lastHarvestTimestamp;
    }

    IERC20 public immutable token;
    mapping(address => UserInfo) public userInfo;
    mapping(address => mapping(address => uint)) public allowances;

    constructor(
        IERC20 _token,
        string memory _name,
        string memory _symbol,
        uint _aprBasisPoints,
        uint _harvestInterval
    ) {
        token = _token;
        name = _name;
        symbol = _symbol;
        aprBasisPoints = _aprBasisPoints;
        harvestInterval = _harvestInterval;
        admin = msg.sender;
        lastRewardTimestamp = block.timestamp;
        decimals = IERC20Metadata(address(_token)).decimals();
    }

    modifier whenNotPaused() {
        require(!paused, "Staking: contract paused.");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Staking: permitted to admin only.");
        _;
    }

    event Pause(bool flag);
    event SetAdmin(address oldAdmin, address newAdmin);
    event SetApr(uint oldBasisPoints, uint newBasisPoints);

    // just return total in staking amount 
    function totalSupply() public view returns (uint256) {
        return amountStaked; 
    }

    function lastDeltaReward() public view returns (uint) {
        uint delta = block.timestamp - lastRewardTimestamp;
        return delta * aprBasisPoints * calcDecimals / aprDenominator / secondsInYear;
    }

    function calculateRewardAmount(uint amount) internal view returns (uint) {
        return accumulatedRewardPerShare * amount / calcDecimals;
    }

    function balanceOf(address _user) public view returns(uint) {
        UserInfo storage user = userInfo[_user];
        uint updAccumulatedRewardPerShare = lastDeltaReward() + accumulatedRewardPerShare;

        uint acc = updAccumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        return user.accumulatedReward + acc + user.amount;
    }

    function setApr(uint _aprBasisPoints) public onlyAdmin {
        updateRewardPool();
        uint oldAprBasisPoints = aprBasisPoints;
        aprBasisPoints = _aprBasisPoints;
        emit SetApr(oldAprBasisPoints, aprBasisPoints);
    }

    function togglePause() public onlyAdmin {
        paused = !paused;
        emit Pause(paused);
    }

    function withdrawToken(IERC20 tokenToWithdraw, address to, uint amount) public onlyAdmin {
        require(tokenToWithdraw.transfer(to,amount));
    }

    function updateAdmin(address _admin) public onlyAdmin {
        address oldAdmin = admin;
        admin = _admin;
        emit SetAdmin(oldAdmin, _admin);
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function approve(address spender, uint amount) public whenNotPaused virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _transfer(
        address _sender,
        address _recipient,
        uint amount
    ) internal {
        updateRewardPool();
        require(_sender != address(0), "ERC20: transfer from the zero address");
        require(_recipient != address(0), "ERC20: transfer to the zero address");

        UserInfo storage sender = userInfo[_sender];
        UserInfo storage recipient = userInfo[_recipient];
        require(amount <= sender.amount, "ERC20: transfer amount exceeds balance");
        // updating balances

        sender.accumulatedReward += calculateRewardAmount(sender.amount) - sender.rewardDebt;
        recipient.accumulatedReward += calculateRewardAmount(recipient.amount) - recipient.rewardDebt;

        // transfering amounts
        sender.amount -= amount;
        recipient.amount += amount;

        sender.rewardDebt = calculateRewardAmount(sender.amount);
        recipient.rewardDebt = calculateRewardAmount(recipient.amount);

        emit Transfer(_sender, _recipient, amount);
    }

    function transfer(address recipient, uint256 amount) public whenNotPaused virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    } 

    function transferFrom(
        address spender,
        address recipient,
        uint256 amount
    ) public whenNotPaused virtual override returns (bool) {
        _transfer(spender, recipient, amount);
        uint256 currentAllowance = allowances[spender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(spender, msg.sender, currentAllowance - amount);
        return true;
    }

    function updateRewardPool() public whenNotPaused {
        accumulatedRewardPerShare += lastDeltaReward();
        lastRewardTimestamp = block.timestamp;
    }

    function stake(uint amount, address to) external whenNotPaused {
        updateRewardPool();
        require(amount > 0, "Staking: Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),amount),"");

        UserInfo storage user = userInfo[to];
        user.accumulatedReward += calculateRewardAmount(user.amount) - user.rewardDebt;
        amountStaked += amount;
        user.amount += amount;
        user.rewardDebt = calculateRewardAmount(user.amount);
    }

    function harvest(uint256 amount) public whenNotPaused {
        updateRewardPool();
        UserInfo storage user = userInfo[msg.sender];
        // +1 to prevent efforts in scum of tstamp
        require(user.lastHarvestTimestamp + harvestInterval + 1 <= block.timestamp || 
            user.lastHarvestTimestamp == 0, "Staking: less than 24 hours since last harvest");
        user.lastHarvestTimestamp = block.timestamp;

        uint reward = calculateRewardAmount(user.amount);
        user.accumulatedReward += reward - user.rewardDebt;
        user.rewardDebt = reward;

        require(amount > 0, "Staking: Nothing to harvest");
        require(amount <= user.accumulatedReward, "Staking: Insufficient to harvest");
        user.accumulatedReward -= amount;
        require(token.transfer(msg.sender,amount),"");
    }

    function unstake(address to, uint256 amount) public whenNotPaused {
        updateRewardPool();
        require(amount > 0, "Staking: Nothing to unstake");

        UserInfo storage user = userInfo[msg.sender];
        require(amount <= user.amount, "Staking: Insufficient share");
        user.accumulatedReward += calculateRewardAmount(user.amount) - user.rewardDebt;
        amountStaked -= amount;
        user.amount -= amount;
        user.rewardDebt = calculateRewardAmount(user.amount);

        require(token.transfer(to,amount),"Staking: Not enough token to transfer");
    }
}
