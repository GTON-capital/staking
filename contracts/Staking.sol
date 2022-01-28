// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract Staking is IERC20, IERC20Metadata {

    uint public calcDecimals = 1e12;
    uint public secondsInYear = 31557600;
    string public name;
    string public symbol;

    address public owner;
    
    bool public paused;
    uint public lastRewardTimestamp;

    uint public accumulatedRewardPerShare;
    uint public totalAmount;
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
        owner = msg.sender;
        lastRewardTimestamp = block.timestamp;
        decimals = IERC20Metadata(address(_token)).decimals();
    }

    modifier whenNotPaused() {
        require(!paused, "Staking: contract paused.");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Staking: permitted to owner only.");
        _;
    }

    event Pause(bool flag);
    event SetOwner(address oldOwner, address newOwner);
    event SetApr(uint oldBasisPoints, uint newBasisPoints);

    // just return total in staking amount 
    function totalSupply() public view returns (uint256) {
        return totalAmount; 
    }

    function rewardPerSecond() public view returns (uint) {
        return aprBasisPoints * calcDecimals / 10000 / secondsInYear;
    }

    function delta() internal view returns (uint) {
        return block.timestamp - lastRewardTimestamp;
    }

    function balanceOf(address _user) public view returns(uint) {
        UserInfo storage user = userInfo[_user];
        uint updAccumulatedRewardPerShare = (delta() * rewardPerSecond()) + accumulatedRewardPerShare;

        uint acc = updAccumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        return user.accumulatedReward + acc + user.amount;
    }

    function setApr(uint _aprBasisPoints) public onlyOwner {
        updateRewardPool();
        uint oldAprBasisPoints = aprBasisPoints;
        aprBasisPoints = _aprBasisPoints;
        emit SetApr(oldAprBasisPoints, aprBasisPoints);
    }

    function togglePause() public onlyOwner {
        paused = !paused;
        emit Pause(paused);
    }

    function withdrawToken(IERC20 _token, address _to, uint _amount) public onlyOwner {
        require(_token.transfer(_to,_amount));
    }

    function transferOwnership(address _owner) public onlyOwner {
        address oldOwner = owner;
        owner = _owner;
        emit SetOwner(oldOwner, _owner);
    }

    function allowance(address _owner, address spender) external view returns (uint256) {
        return allowances[_owner][spender];
    }

    function _approve(
        address _owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }

    function approve(address spender, uint amount) public whenNotPaused virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _transfer(
        address _sender,
        address _recipient,
        uint _amount
    ) internal {
        updateRewardPool();
        require(_sender != address(0), "ERC20: transfer from the zero address");
        require(_recipient != address(0), "ERC20: transfer to the zero address");
        
        UserInfo storage sender = userInfo[_sender];
        UserInfo storage recipient = userInfo[_recipient];
        require(_amount <= sender.amount, "ERC20: transfer amount exceeds balance");
        // updating balances
        sender.accumulatedReward += accumulatedRewardPerShare * sender.amount / calcDecimals - sender.rewardDebt;
        recipient.accumulatedReward += accumulatedRewardPerShare * recipient.amount / calcDecimals - recipient.rewardDebt;

        // transfering amounts
        sender.amount -= _amount;
        recipient.amount += _amount;

        sender.rewardDebt = accumulatedRewardPerShare * sender.amount / calcDecimals;
        recipient.rewardDebt = accumulatedRewardPerShare * recipient.amount / calcDecimals;

        emit Transfer(_sender, _recipient, _amount);
    }

    function transfer(address recipient, uint256 amount) public whenNotPaused virtual override returns (bool) {
        updateRewardPool();
        _transfer(msg.sender, recipient, amount);
        return true;
    } 

    function transferFrom(
        address spender,
        address recipient,
        uint256 amount
    ) public whenNotPaused virtual override returns (bool) {
        updateRewardPool();
        _transfer(spender, recipient, amount);
        uint256 currentAllowance = allowances[spender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(spender, msg.sender, currentAllowance - amount);
        return true;
    }

    function updateRewardPool() public whenNotPaused {
        accumulatedRewardPerShare +=  delta() * rewardPerSecond();
        lastRewardTimestamp = block.timestamp;
    }

    function calculateRewardAmount(uint amount) internal view returns (uint) {
        return accumulatedRewardPerShare * amount / calcDecimals;
    }

    function mint(uint _amount, address _to) external whenNotPaused {
        updateRewardPool();
        require(_amount > 0, "Staking: Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");

        UserInfo storage user = userInfo[_to];
        user.accumulatedReward += calculateRewardAmount(user.amount) - user.rewardDebt;
        totalAmount += _amount;
        user.amount += _amount;
        user.rewardDebt = calculateRewardAmount(user.amount);
    }

    function harvest(uint256 _amount) public whenNotPaused {
        updateRewardPool();
        UserInfo storage user = userInfo[msg.sender];
        // +1 to prevent efforts in scum of tstamp
        require(user.lastHarvestTimestamp + harvestInterval + 1 <= block.timestamp || 
            user.lastHarvestTimestamp == 0, "Staking: less than 24 hours since last harvest");
        user.lastHarvestTimestamp = block.timestamp;

        user.accumulatedReward += calculateRewardAmount(user.amount) - user.rewardDebt;
        user.rewardDebt = calculateRewardAmount(user.amount);

        require(_amount > 0, "Staking: Nothing to harvest");
        require(_amount <= user.accumulatedReward, "Staking: Insufficient to harvest");
        user.accumulatedReward -= _amount;
        require(token.transfer(msg.sender,_amount),"");
    }

    function burn(address _to, uint256 _amount) public whenNotPaused {
        updateRewardPool();
        require(_amount > 0, "Staking: Nothing to burn");

        UserInfo storage user = userInfo[msg.sender];
        require(_amount <= user.amount, "Staking: Insufficient share");
        user.accumulatedReward += calculateRewardAmount(user.amount) - user.rewardDebt;
        totalAmount -= _amount;
        user.amount -= _amount;
        user.rewardDebt = calculateRewardAmount(user.amount);

        require(token.transfer(_to,_amount),"Staking: Not enough token to transfer");
    }
}
