// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";
import "./libraries/AddressArrayLibrary.sol";

contract CompoundStaking is IERC20, IERC20Metadata {
    string public name;
    string public symbol;

    address public owner;
    
    bool public paused;
    uint public totalShares;
    uint public potentiallyMinted;
    uint public lastRewardTimestamp;

    uint public accamulatedRewardPerShare;
    uint public totalAmounts;
    uint public harvestInterval;
 
    uint public aprBasisPoints;

    uint8 public decimals;
    address[] public lpAdmins;

    struct UserInfo {
        uint amount;
        uint rewardDebt;
        uint accamulatedReward;
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
        address[] memory admins,
        uint _harvestInterval
    ) {
        harvestInterval = _harvestInterval;
        owner = msg.sender;
        token = _token;
        lastRewardTimestamp = block.timestamp;
        decimals = IERC20Metadata(address(_token)).decimals();
        name = _name;
        symbol = _symbol;
        aprBasisPoints = _aprBasisPoints;
        lpAdmins = admins;
    }

    modifier whenNotPaused() {
        require(!paused, "Compound: contract paused.");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Compound: permitted to owner only.");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender==owner || AddressArrayLib.indexOf(lpAdmins, msg.sender) != -1, 
            "Compound: permitted to admins only.");
        _;
    }

    event Pause(bool flag);
    event SetOwner(address oldOwner, address newOwner);
    event SetApr(uint oldBasisPoints, uint newBasisPoints);

    // just return total in staking amount 
    function totalSupply() public view returns (uint256) {
        return  totalAmounts; 
    }

    function balanceOf(address _user) public view returns(uint) {
        UserInfo storage user = userInfo[_user];
        uint acc = accamulatedRewardPerShare * user.amount - user.rewardDebt;
        return user.accamulatedReward + acc + user.amount;
    }

    function setAdmins(address[] memory admins) public onlyOwner {
        for(uint i = 0; i < admins.length; i++) {
            lpAdmins.push(admins[i]);
        }
    }

    function removeAdmins(address[] memory admins) public onlyOwner {
        for(uint i = 0; i < admins.length; i++) {
            AddressArrayLib.removeItem(lpAdmins, admins[i]);
        }
    }

    function setApr(uint _aprBasisPoints) public onlyAdmin {
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

        sender.accamulatedReward += accamulatedRewardPerShare * sender.amount - sender.rewardDebt;
        recipient.accamulatedReward += accamulatedRewardPerShare * recipient.amount - recipient.rewardDebt;

        sender.amount -= _amount;
        recipient.amount += _amount;

        sender.rewardDebt = accamulatedRewardPerShare * sender.amount;
        recipient.rewardDebt = accamulatedRewardPerShare * recipient.amount;

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
        uint delta = block.timestamp - lastRewardTimestamp;
        accamulatedRewardPerShare +=  totalAmounts * delta * aprBasisPoints / 10000 / 31557600;
        lastRewardTimestamp = block.timestamp;
    }

    function mint(uint _amount, address _to) external whenNotPaused {
        updateRewardPool();
        require(_amount > 0, "Compound: Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");

        UserInfo storage user = userInfo[_to];
        user.accamulatedReward += accamulatedRewardPerShare * user.amount - user.rewardDebt;
        totalAmounts += _amount;
        user.amount += _amount;
        user.rewardDebt = accamulatedRewardPerShare * user.amount;
    }

    function harvest(uint256 _amount) public whenNotPaused {
        updateRewardPool();
        UserInfo storage user = userInfo[msg.sender];
        // +1 to prevent efforts in scum of tstamp
        require(user.lastHarvestTimestamp + harvestInterval + 1 > block.timestamp || 
            user.lastHarvestTimestamp == 0,"not so fast");
        user.lastHarvestTimestamp = block.timestamp;

        user.accamulatedReward += accamulatedRewardPerShare * user.amount - user.rewardDebt;
        require(_amount > 0, "Compound: Nothing to harvest");
        require(_amount <= user.accamulatedReward, "Compound: isufficient to harvest");
        user.accamulatedReward -= _amount;
        require(token.transfer(msg.sender,_amount),"");
    }

    function burn(address _to, uint256 _amount) public whenNotPaused {
        updateRewardPool();
        require(_amount > 0, "Compound: Nothing to burn");

        UserInfo storage user = userInfo[msg.sender];
        user.accamulatedReward += accamulatedRewardPerShare * user.amount - user.rewardDebt;
        totalAmounts -= _amount;
        user.amount -= _amount;
        user.rewardDebt = accamulatedRewardPerShare * user.amount;

        require(token.transfer(_to,_amount),"Compound: Not enough token to transfer");
    }
}
