// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract Staking is IERC20, IERC20Metadata {

    /* ========== HELPER STRUCTURES ========== */

    struct UserInfo {
        uint amount;
        uint accumulatedReward;
        uint recountTimestamp;
        uint harvestTimestamp;
    }

    /* ========== CONSTANTS ========== */

    IERC20 public immutable stakingToken;

    string public name;
    string public symbol;
    uint public immutable aprBasisPoints;
    uint public immutable harvestInterval;
    uint8 public immutable decimals;

    uint public constant calcDecimals = 1e12;
    uint public constant secondsInYear = 31557600;
    uint public constant aprDenominator = 10000;

    /* ========== STATE VARIABLES ========== */

    address public admin;
    bool public paused;

    uint public amountStaked;

    mapping(address => UserInfo) public userInfo;
    mapping(address => mapping(address => uint)) public allowances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        IERC20 _token,
        string memory _name,
        string memory _symbol,
        uint _aprBasisPoints,
        uint _harvestInterval
    ) {
        stakingToken = _token;
        name = _name;
        symbol = _symbol;
        aprBasisPoints = _aprBasisPoints;
        harvestInterval = _harvestInterval;
        admin = msg.sender;
        decimals = IERC20Metadata(address(_token)).decimals();
    }

    /* ========== VIEWS ========== */

    function totalSupply() public view returns (uint256) {
        return amountStaked; 
    }

    function calculateRewardDelta(UserInfo memory user) internal view returns (uint) {
        uint timeDelta = block.timestamp - user.recountTimestamp;
        return (user.amount * timeDelta * aprBasisPoints / aprDenominator) / secondsInYear;
    }

    function balanceOf(address _user) public view returns(uint) {
        UserInfo storage user = userInfo[_user];

        return user.accumulatedReward + calculateRewardDelta(user);
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

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
        require(_sender != address(0), "ERC20: transfer from the zero address");
        require(_recipient != address(0), "ERC20: transfer to the zero address");

        UserInfo storage sender = userInfo[_sender];
        UserInfo storage recipient = userInfo[_recipient];
        require(amount <= sender.amount, "ERC20: transfer amount exceeds balance");

        // Updating balances
        sender.accumulatedReward += calculateRewardDelta(sender);
        recipient.accumulatedReward += calculateRewardDelta(recipient);

        // Transfering amounts
        sender.amount -= amount;
        recipient.amount += amount;

        sender.recountTimestamp = block.timestamp;
        recipient.recountTimestamp = block.timestamp;

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

    function stake(uint amount, address to) external whenNotPaused {
        require(amount > 0, "Staking: Nothing to deposit");
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Staking: transfer failed");

        UserInfo storage user = userInfo[to];
        user.accumulatedReward += calculateRewardDelta(user);
        amountStaked += amount;
        user.amount += amount;
        user.recountTimestamp = block.timestamp;
    }

    function harvest(uint256 amount) public whenNotPaused {
        UserInfo storage user = userInfo[msg.sender];
        require(user.harvestTimestamp + harvestInterval <= block.timestamp || 
            user.harvestTimestamp == 0, "Staking: less than 24 hours since last harvest");
        user.harvestTimestamp = block.timestamp;

        user.accumulatedReward += calculateRewardDelta(user);
        user.recountTimestamp = block.timestamp;

        require(amount > 0, "Staking: Nothing to harvest");
        require(amount <= user.accumulatedReward, "Staking: Insufficient to harvest");
        user.accumulatedReward -= amount;
        require(stakingToken.transfer(msg.sender,amount), "Staking: transfer failed");
    }

    function unstake(address to, uint256 amount) public whenNotPaused {
        require(amount > 0, "Staking: Nothing to unstake");

        UserInfo storage user = userInfo[msg.sender];
        require(amount <= user.amount, "Staking: Insufficient share");
        user.accumulatedReward += calculateRewardDelta(user);
        user.amount -= amount;
        user.recountTimestamp = block.timestamp;
        amountStaked -= amount;

        require(stakingToken.transfer(to, amount), "Staking: Not enough token to transfer");
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function togglePause() public onlyAdmin {
        paused = !paused;
        emit Pause(paused);
    }

    function withdrawToken(IERC20 tokenToWithdraw, address to, uint amount) public onlyAdmin {
        require(tokenToWithdraw.transfer(to, amount));
    }

    function updateAdmin(address _admin) public onlyAdmin {
        address oldAdmin = admin;
        admin = _admin;
        emit SetAdmin(oldAdmin, _admin);
    }

    /* ========== MODIFIERS ========== */

    modifier whenNotPaused() {
        require(!paused, "Staking: contract paused.");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Staking: permitted to admin only.");
        _;
    }

    /* ========== EVENTS ========== */

    event Pause(bool flag);
    event SetAdmin(address oldAdmin, address newAdmin);
}
