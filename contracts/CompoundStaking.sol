// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";
import "./libraries/AddressArrayLibrary.sol";

contract CompoundStaking is IERC20 {
    string public name;
    string public symbol;

    address public owner;
    
    bool public revertFlag;
    uint public lastRewardTimestamp;

    uint public accumulatedRewardPerShare;
    uint public totalAmounts;
    uint public harvestInterval;
 
    uint public apyNominator;
    uint public apyDenominator;
    uint public calcDecimals = 1e12;
    uint public decimals;
    address[] public admins;

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
        uint _apyNominator,
        uint _apyDenominator,
        address[] memory _admins,
        uint _harvestInterval
    ) {
        harvestInterval = _harvestInterval;
        owner = msg.sender;
        token = _token;
        lastRewardTimestamp = block.timestamp;
        decimals = token.decimals();
        name = _name;
        symbol = _symbol;
        apyNominator = _apyNominator;
        apyDenominator = _apyDenominator;
        admins = _admins;
    }

    modifier notReverted() {
        require(!revertFlag, "Compound: reverted flag on.");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Compound: permitted to owner only.");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender==owner || AddressArrayLib.indexOf(admins, msg.sender) != -1, 
            "Compound: permitted to admins only.");
        _;
    }

    event RevertFlag(bool flag);
    event SetOwner(address oldOwner, address newOwner);
    event SetApy(uint oldDown, uint oldUp, uint newDown, uint newUp);
    event SetBlockInYear(uint oldBlocksInYear, uint newBlocksInYear);
    
    function totalSupply() public view returns (uint256) {
        return  totalAmounts; 
    }

    function balanceOf(address _user) public view returns(uint) {
        UserInfo storage user = userInfo[_user];
        uint delta = block.timestamp - lastRewardTimestamp;
        uint updAccumulatedRewardPerShare = 
            (delta * apyNominator * calcDecimals / apyDenominator / 31557600) + accumulatedRewardPerShare;

        uint acc = updAccumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        return user.accumulatedReward + acc + user.amount;
    }

    function setAdmins(address[] memory _admins) public onlyOwner {
        for(uint i = 0; i < _admins.length; i++) {
            admins.push(_admins[i]);
        }
    }

    function removeAdmins(address[] memory _admins) public onlyOwner {
        for(uint i = 0; i < _admins.length; i++) {
            AddressArrayLib.removeItem(admins, _admins[i]);
        }
    }

    function setApy(uint _apyNominator, uint _apyDenominator) public onlyAdmin {
        updateRewardPool();
        uint oldDown = apyDenominator;
        uint oldUp = apyNominator;
        apyNominator = _apyNominator;
        apyDenominator = _apyDenominator;
        emit SetApy(oldDown, oldUp, _apyDenominator, _apyNominator);
    }

    function toggleRevert() public onlyOwner {
        revertFlag = !revertFlag;
        emit RevertFlag(revertFlag);
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

    function approve(address spender, uint amount) public notReverted virtual override returns (bool) {
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

    function transfer(address recipient, uint256 amount) public notReverted virtual override returns (bool) {
        updateRewardPool();
        _transfer(msg.sender, recipient, amount);
        return true;
    } 

    function transferFrom(
        address spender,
        address recipient,
        uint256 amount
    ) public notReverted virtual override returns (bool) {
        updateRewardPool();
        _transfer(spender, recipient, amount);
        uint256 currentAllowance = allowances[spender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(spender, msg.sender, currentAllowance - amount);
        return true;
    }

    function updateRewardPool() public notReverted {
        uint delta = block.timestamp - lastRewardTimestamp;
        accumulatedRewardPerShare +=  delta * apyNominator * calcDecimals / apyDenominator / 31557600;
        lastRewardTimestamp = block.timestamp;
    }

    function mint(uint _amount, address _to) external notReverted {
        updateRewardPool();
        require(_amount > 0, "Compound: Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");

        UserInfo storage user = userInfo[_to];
        user.accumulatedReward += accumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        totalAmounts += _amount;
        user.amount += _amount;
        user.rewardDebt = accumulatedRewardPerShare * user.amount / calcDecimals;
    }

    function harvest(uint256 _amount) public notReverted {
        updateRewardPool();
        UserInfo storage user = userInfo[msg.sender];
        require(user.lastHarvestTimestamp + harvestInterval >= block.timestamp || 
            user.lastHarvestTimestamp == 0,"Compound: less than 24 hours since last harvest");
        user.lastHarvestTimestamp = block.timestamp;

        user.accumulatedReward += accumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        user.rewardDebt += accumulatedRewardPerShare * user.amount / calcDecimals;

        require(_amount > 0, "Compound: Nothing to harvest");
        require(_amount <= user.accumulatedReward, "Compound: isufficient to harvest");
        user.accumulatedReward -= _amount;

        require(token.transfer(msg.sender,_amount),"Compound: error transfer from");
    }

    function burn(address _to, uint256 _amount) public notReverted {
        updateRewardPool();
        require(_amount > 0, "Compound: Nothing to burn");

        UserInfo storage user = userInfo[msg.sender];
        require(_amount <= user.amount, "Compound: Insufficient share");
        user.accumulatedReward += accumulatedRewardPerShare * user.amount / calcDecimals - user.rewardDebt;
        totalAmounts -= _amount;
        user.amount -= _amount;
        user.rewardDebt = accumulatedRewardPerShare * user.amount / calcDecimals;

        require(token.transfer(_to,_amount),"Compound: Not enough token to transfer");
    }
}
