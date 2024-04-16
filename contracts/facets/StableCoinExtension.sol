// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {AccessControlLib} from "./AccessControlFacet.sol";
import {CreditPoolLib} from "./CreditPoolFacet.sol";
import {VaultLib} from "./VaultFacet.sol";
import {LenderLib} from "./LenderFacet.sol";
import {PaymentLib} from "./PaymentFacet.sol";

error PoolTokenInitializedBefore(string poolId);
error InvalidToken(address poolToken);
error EnforcedPause();
error InvalidAmount(uint256 amount);

/// @title Stable Coin Library
library StableCoinLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.stablecoin.storage");

    struct StableCoinState {
        mapping (string => address) poolToken;
        mapping (address => bool) isWhitelisted;
        mapping (string => mapping (address => uint256)) stableCoinBalance;
        mapping (address => address) requestedToken;
        mapping (string => address) paymentStableCoin;
        mapping (string => uint256) paidBalance;
        mapping (string => uint64) lastWithdrawalTimeStamp;
        uint64 lenderThreshold;
        uint64 poolThreshold;
        uint64 lenderCoolingTime;
        uint64 poolCoolingTime;
    }

    /// @dev Returns storage position of stable coin library inside diamond
    function diamondStorage() internal pure returns (StableCoinState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Returns address of stable coin associated with given credit pool
    /// @param _poolId PoolId of given credit pool 
    function getPoolToken(string memory _poolId) internal view returns (address) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.poolToken[_poolId];
    }

    /// @dev Returns whitelisting status of given stable coin
    /// @param _token Address of given stable coin
    function isWhitelistedToken(address _token) internal view returns (bool) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.isWhitelisted[_token];
    }

    /// @dev Returns stable coin balance of given vault account
    /// @param _roleId RoleId associated with given vault account
    /// @param _token Address of stable coin
    function getStableCoinBalance(string calldata _roleId, address _token) internal view returns (uint256) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.stableCoinBalance[_roleId][_token];
    }

    /// @dev Returns address of stable coin requested to be withdrawn by given wallet address
    /// @param _reqWallet Wallet address who requested given tokens to be withdrawn from vault 
    function getRequestedToken(address _reqWallet) internal view returns (address) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.requestedToken[_reqWallet];
    }

    /// @dev Returns address of stable coin associated with given payment
    /// @param _paymentId PaymentId of given payment
    function getPaymentStableCoin(string memory _paymentId) internal view returns (address) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.paymentStableCoin[_paymentId];
    }

    /// @dev Returns threshold amount for lender auto withdrawal
    function getLenderThreshold() internal view returns (uint64) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.lenderThreshold;
    }
    
    /// @dev Returns threshold amount for investment auto withdrawal
    function getPoolThreshold() internal view returns (uint64) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.poolThreshold;
    }

    /// @dev Returns cooling time in seconds for lender auto withdrawal
    function getLenderCoolingTime() internal view returns (uint64) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.lenderCoolingTime;
    }

    /// @dev Returns cooling time in seconds for investment auto withdrawal
    function getPoolCoolingTime() internal view returns (uint64) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.poolCoolingTime;
    }

    /// @dev Returns undistributed amount of given pool
    /// @param _roleId PoolId of given credit pool
    function getPaidBalance(string calldata _roleId) internal view returns (uint256) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.paidBalance[_roleId];
    }

    /// @dev Returns timestamp of last withdrawal
    /// @param _roleId RoleId / PoolId of given lender / credit pool
    function getLastWithdrawalTimeStamp(string calldata _roleId) internal view returns (uint64) {
        StableCoinState storage stableCoinState = diamondStorage();
        return stableCoinState.lastWithdrawalTimeStamp[_roleId];
    }

    /// @dev Initializes stable coin information of given pool
    /// @notice Restricted access function, should be called by an address with create manager role
    /// @param _poolId PoolId of given credit pool
    /// @param _poolToken Address of stable coin associated with given credit pool
    function initializePoolToken(string calldata _poolId, address _poolToken) internal {
        AccessControlLib.enforceIsCreateManager();
        CreditPoolLib.enforceIsCreditPoolIdExist(_poolId);
        StableCoinState storage stableCoinState = diamondStorage();
        if(!stableCoinState.isWhitelisted[_poolToken]) {
            revert InvalidToken(_poolToken);
        }
        if(stableCoinState.poolToken[_poolId] == address(0)) {
            stableCoinState.poolToken[_poolId] = _poolToken;
        }
    }

    /// @dev Removes stable coin information of given pool
    /// @notice Called internally whenever pool has been deleted
    /// @param _poolId PoolId of given credit pool
    function deletePoolToken(string calldata _poolId) internal {
        CreditPoolLib.enforceIsCreditPool();
        StableCoinState storage stableCoinState = diamondStorage();
        delete stableCoinState.poolToken[_poolId];
    }

    /// @dev Adds / Removes stable coin to/from whitelist
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _token Address of stable coin
    function updateWhitelist(address _token) internal {
        AccessControlLib.enforceIsConfigManager();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.isWhitelisted[_token] = !stableCoinState.isWhitelisted[_token];
    }

    /// @dev Updates threshold amount for lender auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _threshold New threshold amount to set
    function updateLenderThreshold(uint64 _threshold) internal {
        AccessControlLib.enforceIsConfigManager();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.lenderThreshold = _threshold;
    }

    /// @dev Updates threshold amount for investment auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _threshold New threshold amount to set
    function updatePoolThreshold(uint64 _threshold) internal {
        AccessControlLib.enforceIsConfigManager();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.poolThreshold = _threshold;
    }

    /// @dev Updates cooling time in seconds for lender auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _time New cooling time in seconds
    function updateLenderCoolingTime(uint64 _time) internal {
        AccessControlLib.enforceIsConfigManager();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.lenderCoolingTime = _time;
    }

    /// @dev Updates cooling time in seconds for investment auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _time New cooling time in seconds
    function updatePoolCoolingTime(uint64 _time) internal {
        AccessControlLib.enforceIsConfigManager();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.poolCoolingTime = _time;
    }

    /// @dev Increases stable coin balance of given lender
    /// @notice Called internally whenever stable coin balance of given lender gets increased
    /// @param _roleId LenderId of given lender
    /// @param _token Address of stable coin
    /// @param _amount Amount of stable coin to be added into lender stable coin balance
    function increaseBalance(string memory _roleId, address _token, uint256 _amount) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.stableCoinBalance[_roleId][_token] += _amount;
    }

    /// @dev Decreases stable coin balance of given lender
    /// @notice Called internally whenever stable coin balance of given lender gets decreased
    /// @param _roleId LenderId of given lender
    /// @param _token Address of stable coin
    /// @param _amount Amount of stable coin to be subtracted from lender stable coin balance
    function decreaseBalance(string memory _roleId, address _token, uint256 _amount) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.stableCoinBalance[_roleId][_token] -= _amount;
    }

    /// @dev Increases paid balance of given pool
    /// @notice Called internally whenever paid balance of given pool gets increased
    /// @param _roleId PoolId of given credit pool
    /// @param _amount Amount of stable coin to be added into pool paid balance
    function increasePaidBalance(string memory _roleId, uint256 _amount) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.paidBalance[_roleId] += _amount;
    }

    /// @dev Decreases paid balance of given pool
    /// @notice Called internally whenever paid balance of given pool gets decreased
    /// @param _roleId PoolId of given credit pool
    /// @param _amount Amount of stable coin to be subtracted from pool paid balance
    function decreasePaidBalance(string memory _roleId, uint256 _amount) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.paidBalance[_roleId] -= _amount;
    }

    /// @dev Updates last withdrawal time of given lender / pool
    /// @notice Called internally whenever lender / pool withdrawal processed automatically
    /// @param _roleId LenderId / PoolId of given lender / credit pool
    /// @param _timeStamp Timestamp of last withdrawal
    function updateLastWithdrawalTimeStamp(string memory _roleId, uint64 _timeStamp) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.lastWithdrawalTimeStamp[_roleId] = _timeStamp;
    }

    /// @dev Binds requested stable coin information with given wallet address
    /// @notice Called internally whenever given wallet requests to withdraw stable coin
    /// @param _reqWallet Wallet address who requested given tokens to be withdrawn from vault
    /// @param _token Address of requested stable coin
    function addRequestedToken(address _reqWallet, address _token) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.requestedToken[_reqWallet] = _token;
    }

    /// @dev Binds stable coin information with given payment
    /// @notice Called internally whenever a direct payment in given stable coin has been initiated
    /// @param _paymentId PaymentId of given payment
    /// @param _token Address of stable coin
    function addPaymentStableCoin(string memory _paymentId, address _token) internal {
        VaultLib.enforceIsVault();
        StableCoinState storage stableCoinState = diamondStorage();
        stableCoinState.paymentStableCoin[_paymentId] = _token;
    }
}

/// @title Stable Coin Facet
contract StableCoinExtension {
    event UpdatePoolToken(string indexed poolId, address poolToken);
    event UpdateWhitelist(address indexed token, bool isWhitelisted);
    event UpdateLenderThreshold(uint64 prevThreshold, uint64 newThreshold);
    event UpdatePoolThreshold(uint64 prevThreshold, uint64 newThreshold);
    event UpdateLenderCoolingTime(uint64 prevTime, uint64 newTime);
    event UpdatePoolCoolingTime(uint64 prevTime, uint64 newTime);
    event CreateCreditPoolEvent(CreditPoolLib.CreditPool creditPool);
    event AdjustStableCoin(string indexed roleId, uint256 amount, address token, PaymentLib.PaymentType paymentType);
    event EmergencyWithdraw(address indexed executor, address token, address receiver, uint256 amount);

    /// @dev Returns address of stable coin associated with given credit pool
    /// @param _poolId PoolId of given credit pool 
    function getPoolToken(string calldata _poolId) external view returns (address) {
        return StableCoinLib.getPoolToken(_poolId);
    }

    /// @dev Returns whitelisting status of given stable coin
    /// @param _token Address of given stable coin
    function isWhitelistedToken(address _token) external view returns (bool) {
        return StableCoinLib.isWhitelistedToken(_token);
    }

    /// @dev Returns stable coin balance of given vault account
    /// @param _roleId RoleId associated with given vault account
    /// @param _token Address of stable coin
    function getStableCoinBalance(string calldata _roleId, address _token) external view returns (uint256) {
        return StableCoinLib.getStableCoinBalance(_roleId, _token);
    }

    /// @dev Returns address of stable coin requested to be withdrawn by given wallet address
    /// @param _reqWallet Wallet address who requested given tokens to be withdrawn from vault 
    function getRequestedToken(address _reqWallet) external view returns (address) {
        return StableCoinLib.getRequestedToken(_reqWallet);
    }

    /// @dev Returns address of stable coin associated with given payment
    /// @param _paymentId PaymentId of given payment
    function getPaymentStableCoin(string memory _paymentId) external view returns (address) {
        return StableCoinLib.getPaymentStableCoin(_paymentId);
    }

    /// @dev Returns threshold amount for lender auto withdrawal
    function getLenderThreshold() external view returns (uint64) {
        return StableCoinLib.getLenderThreshold();
    }
    
    /// @dev Returns threshold amount for investment auto withdrawal
    function getPoolThreshold() external view returns (uint64) {
        return StableCoinLib.getPoolThreshold();
    }

    /// @dev Returns cooling time in seconds for lender auto withdrawal
    function getLenderCoolingTime() external view returns (uint64) {
        return StableCoinLib.getLenderCoolingTime();
    }

    /// @dev Returns cooling time in seconds for investment auto withdrawal
    function getPoolCoolingTime() external view returns (uint64) {
        return StableCoinLib.getPoolCoolingTime();
    }

    /// @dev Returns undistributed amount of given pool
    /// @param _roleId PoolId of given credit pool
    function getPaidBalance(string calldata _roleId) external view returns (uint256) {
        return StableCoinLib.getPaidBalance(_roleId);
    }

    /// @dev Returns timestamp of last withdrawal
    /// @param _roleId RoleId / PoolId of given lender / credit pool
    function getLastWithdrawalTimeStamp(string calldata _roleId) external view returns (uint64) {
        return StableCoinLib.getLastWithdrawalTimeStamp(_roleId);
    }

    /// @dev Initializes stable coin information of given pool
    /// @notice Restricted access function, should be called by an address with create manager role
    /// @param _poolId PoolId of given credit pool
    /// @param _poolToken Address of stable coin associated with given credit pool
    function initializePoolToken(string calldata _poolId, address _poolToken) external {
        StableCoinLib.initializePoolToken(_poolId, _poolToken);
        emit UpdatePoolToken(_poolId, _poolToken);
    }

    /// @dev Adds / Removes stable coin to/from whitelist
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _token Address of stable coin
    function updateWhitelist(address _token) external {
        StableCoinLib.updateWhitelist(_token);
        bool _isWhitelisted = StableCoinLib.isWhitelistedToken(_token);
        emit UpdateWhitelist(_token, _isWhitelisted);
    }

    /// @dev Updates threshold amount for lender auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _threshold New threshold amount to set
    function updateLenderThreshold(uint64 _threshold) external {
        uint64 _prev = StableCoinLib.getLenderThreshold();
        emit UpdateLenderThreshold(_prev, _threshold);
        StableCoinLib.updateLenderThreshold(_threshold);
    }

    /// @dev Updates threshold amount for investment auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _threshold New threshold amount to set
    function updatePoolThreshold(uint64 _threshold) external {
        uint64 _prev = StableCoinLib.getPoolThreshold();
        emit UpdatePoolThreshold(_prev, _threshold);
        StableCoinLib.updatePoolThreshold(_threshold);
    }

    /// @dev Updates cooling time in seconds for lender auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _time New cooling time in seconds
    function updateLenderCoolingTime(uint64 _time) external {
        uint64 _prev = StableCoinLib.getLenderCoolingTime();
        emit UpdateLenderCoolingTime(_prev, _time);
        StableCoinLib.updateLenderCoolingTime(_time);
    }

    /// @dev Updates cooling time in seconds for investment auto withdrawal
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _time New cooling time in seconds
    function updatePoolCoolingTime(uint64 _time) external {
        uint64 _prev = StableCoinLib.getPoolCoolingTime();
        emit UpdatePoolCoolingTime(_prev, _time);
        StableCoinLib.updatePoolCoolingTime(_time);
    }

    /// @dev Creates a new credit pool
    /// @notice Restricted access function, should be called by an address with create manager role
    /// @param _creditPoolId Id associated with credit pool
    /// @param _poolManagerId PoolManagerId of manager who owns the pool
    /// @param _metaHash IPFS hash of credit pool
    /// @param _borrowingAmount Pool size
    /// @param _inceptionTime Credit pool inception time (Unix timestamp)
    /// @param _expiryTime Credit pool cut-off time (Unix timestamp)
    /// @param _curingPeriod Curing period of credit pool in seconds
    /// @param _status Status of cresit pool
    /// @param _poolToken Address of stable coin to be used as payment token
    function createCreditPool(
        string calldata _creditPoolId,
        string calldata _poolManagerId,
        string calldata _metaHash,
        uint256 _borrowingAmount,
        uint64 _inceptionTime,
        uint64 _expiryTime,
        uint32 _curingPeriod,
        CreditPoolLib.CreditPoolStatus _status,
        address _poolToken
    ) external {
        CreditPoolLib.CreditPool memory creditPool = CreditPoolLib.createCreditPool(_creditPoolId, _poolManagerId, _metaHash, _borrowingAmount, _inceptionTime, _expiryTime, _curingPeriod, _status);
        emit CreateCreditPoolEvent(creditPool);
        StableCoinLib.initializePoolToken(_creditPoolId, _poolToken);
        emit UpdatePoolToken(_creditPoolId, _poolToken);       
    }

    /// @dev Adjusts balance of lender account in case of correction
    /// @notice Restricted access function, should be called by an owner only
    /// @param _roleId LenderId of a vault account
    /// @param _amount Amount of payment token to adjust
    /// @param _token Address of stable coin
    /// @param _type Type of adjustment (deposit / withdraw) 
    function adjustStableCoinBalance(
        string calldata _roleId,
        uint256 _amount,
        address _token,
        PaymentLib.PaymentType _type
    ) external {
        VaultLib.adjustStableCoinBalance(_roleId, _amount, _token, _type);
        emit AdjustStableCoin(_roleId, _amount, _token, _type);
    }

    /// @dev Withdraws ERC20 token from contract in case of emergency
    /// @notice Restricted access function, should be called by an owner only
    /// @param _token Address of ERC20 token to withdraw
    /// @param _to Address of receiver
    /// @param _amount Amount of ERC20 token to withdraw from contract 
    function emergencyWithdraw(address _token, address _to, uint256 _amount) external {
        VaultLib.emergencyWithdraw(_token, _to, _amount);
        emit EmergencyWithdraw(msg.sender, _token, _to, _amount);
    }
}