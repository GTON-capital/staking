// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "./interfaces/IERC20.sol";

contract CompoundStaking is IERC20 {
    struct UserInfo {
        uint share;
        uint tokenAtLastUserAction;
    }

    IERC20 public immutable token;
    mapping(address => UserInfo) public userInfo;
    mapping(address => mapping(address => uint)) public allowances;

    uint256 public totalShares;
    address public owner;
    uint public blocksInYear;
    uint public apyUp;
    uint public apyDown;
    uint public potentiallyMinted;
    uint public lastRewardBlock;
    uint public requiredBalance;
    bool public revertFlag;
    string public name;
    string public symbol;
    uint public decimals;

    constructor(
        IERC20 _token,
        uint _blocksInYear,
        string memory _name,
        string memory _symbol
    ) {
        token = _token;
        blocksInYear = _blocksInYear;
        lastRewardBlock = block.number;
        decimals = token.decimals();
        name = _name;
        symbol = _symbol;
    }

    function totalSupply() external view returns (uint256) {
        return requiredBalance;
    }

    function allowance(address _owner, address spender) external view returns (uint256) {
        return allowances[_owner][spender];
    }

    function approve(address spender, uint amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint amount
    ) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint transferShare = balanceToShare(amount);
        require(userInfo[sender].share >= transferShare, "ERC20: transfer amount exceeds balance");
        userInfo[sender].share -= transferShare;
        userInfo[recipient].share += transferShare;

        emit Transfer(sender, recipient, amount);
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
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

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        uint256 currentAllowance = allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);
        return true;
    }

    modifier notReverted() {
        require(!revertFlag, "owner: wut?");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner: wut?");
        _;
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

    // TODO: array of oracles midifyer + owner
    function setBlocksInYear(uint _blocksInYear) public {
        updateRewardPool();
        blocksInYear = _blocksInYear;
    }

    function toggleRevert() public onlyOwner {
        revertFlag = !revertFlag;
    }

    function withdrawToken(IERC20 _token, address _to, uint _amount) public onlyOwner {
            require(_token.transfer(_to,_amount));
    }

    function mint(uint _amount, address _to) external {
        updateRewardPool();
        require(_amount > 0, "Nothing to deposit");
        require(token.transferFrom(msg.sender,address(this),_amount),"");
        uint256 currentShares = 0;
        if (totalShares != 0) {
            currentShares = _amount * totalShares / requiredBalance;
        } else {
            currentShares = _amount;
        }
        UserInfo storage user = userInfo[_to];
        user.share += currentShares;
        user.tokenAtLastUserAction = balanceOf(_to);
        totalShares += currentShares;
        requiredBalance += _amount;
    }

    function balanceOf(address _user) public view returns(uint) { 
        return userInfo[_user].share * requiredBalance / totalShares;
    }

    function shareToBalance(uint _share) public view returns(uint) { 
        return _share * requiredBalance / totalShares;
    }

    function balanceToShare(uint _balance) public view returns(uint) { 
        return _balance * totalShares / requiredBalance;
    }

    function burn(address _to, uint256 _share) public {
        updateRewardPool();

        UserInfo storage user = userInfo[msg.sender];
        require(_share <= user.share, "Withdraw amount exceeds balance");
        uint256 currentAmount = requiredBalance * _share / totalShares;
    
        user.share -= _share;
        totalShares -= _share;
        requiredBalance -= currentAmount;
        user.tokenAtLastUserAction = balanceOf(msg.sender);
        require(token.transfer(_to,currentAmount),"not enough token to transfer");
    }
}