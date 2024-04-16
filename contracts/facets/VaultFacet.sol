// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LenderLib} from "./LenderFacet.sol";
import {CreditPoolLib} from "./CreditPoolFacet.sol";
import {PoolManagerLib} from "./PoolManagerFacet.sol";
import {PaymentLib} from "./PaymentFacet.sol";
import {AccessControlLib} from "./AccessControlFacet.sol";
import {StableCoinLib} from "./StableCoinExtension.sol";
import {DistributeLib} from "./DistributeExtension.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

error NotVaultCall();
error PaymentTokenIsInitialized(address token);
error InvalidAmount(uint256 amount);
error InvalidPaymentType(PaymentLib.PaymentType paymentType);
error CuringPeriodIsNotOver(string roleId);
error PendingRequestExist(string roleId);
error InvalidRequestIndex(uint256 index);
error EnforcedPause();
error ExpectedPause();
error InvalidPoolToken(address poolToken);
error InvalidFunction();

/// @title Vault library
library VaultLib {
    using SafeERC20 for IERC20;
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.vault.storage");

    struct VaultState {
        mapping(string => uint256) vaultBalance;
        mapping(string => uint256) borrowedAmount;
        mapping(string => RequestStatus) pendingRequest;
        Request[] requests;
        uint256 minDepositLimit;
        address paymentToken;
        bool isVaultCall;
        bool paused;
    }

    struct Request {
        string roleId;
        string poolId;
        address wallet;
        RequestType requestType;
        uint256 amount;
    }

    struct RequestStatus {
        bool isPending;
        uint256 requestIndex;
    }

    struct PaymentInfo {
        uint256 amount;
        PaymentLib.PaymentType paymentType;
    }

    enum RequestType {INVESTMENT, WITHDRAW, RECEIVE}

    enum AccountType {LENDER, POOL}

    event Exit(string indexed roleId, string poolId, uint256 amount);
    event Fee(string indexed poolId, uint256 amount);

    modifier whenNotPaused() {
        requireNotPaused();
        _;
    }

    modifier whenPaused() {
        requirePaused();
        _;
    }
    
    /// @dev Returns storage position of vault library inside diamond
    function diamondStorage() internal pure returns (VaultState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Returns vault balance of given vault account
    /// @param _roleId RoleId associated with given vault account  
    function getVaultBalance(string calldata _roleId) internal view returns (uint256) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.vaultBalance[_roleId];
    }

    /// @dev Returns stable coin balance of given vault account
    /// @param _roleId RoleId associated with given vault account
    /// @param _token Address of stable coin  
    function getTokenBalance(string calldata _roleId, address _token) internal view returns (uint256) {
        if(_token == getPaymentToken()) {
            return getVaultBalance(_roleId);
        } else {
            return StableCoinLib.getStableCoinBalance(_roleId, _token);
        }
    }

    /// @dev Returns amount already borrowed by given pool
    /// @param _poolId PoolId associated with given pool
    function getBorrowedAmount(string memory _poolId) internal view returns (uint256) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.borrowedAmount[_poolId];
    }

    /// @dev Returns minimum amount that needs to be deposited 
    function getMinDepositLimit() internal view returns (uint256) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.minDepositLimit;
    }

    /// @dev Returns contract address of payment token
    function getPaymentToken() internal view returns (address) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.paymentToken;
    }

    /// @dev Returns request status of given user
    /// @param _roleId LenderId / PoolManagerId of given user
    function getRequestStatus(string calldata _roleId) internal view returns (RequestStatus memory) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.pendingRequest[_roleId];
    }

    /// @dev Returns request list
    function getRequests() internal view returns (Request[] memory) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.requests;
    }

    /// @dev Returns request data associated with request index
    /// @param _reqIndex Request index to query for data
    function getRequestByIndex(uint256 _reqIndex) internal view returns (Request memory) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.requests[_reqIndex];
    }

    /// @dev Returns number of requests registered so far 
    function getRequestsLength() internal view returns (uint256) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.requests.length;
    }

    /// @dev Returns true if contract is paused for certain operations
    function paused() internal view returns (bool) {
        VaultState storage vaultState = diamondStorage();
        return vaultState.paused;
    }

    /// @dev Initializes payment token address
    /// @notice This function can be called only once, throws error if the address is already set
    /// @notice Restricted access function, should be called by owner only
    /// @param _token Address of payment token
    function initializePaymentToken(address _token) internal {
        LibDiamond.enforceIsContractOwner();
        VaultState storage vaultState = diamondStorage();
        if(vaultState.paymentToken != address(0)) {
            revert PaymentTokenIsInitialized(vaultState.paymentToken);
        }
        vaultState.paymentToken = _token;
    }

    /// @dev Sets minimum deposit limit
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _limit New limit to set
    function setMinDepositLimit(uint256 _limit) internal {
        AccessControlLib.enforceIsConfigManager();
        VaultState storage vaultState = diamondStorage();
        vaultState.minDepositLimit = _limit;
    }

    /// @dev Pauses the contract to restrict certain functions
    /// @notice Restricted access function, should be called by owner only
    function pause() internal whenNotPaused {
        LibDiamond.enforceIsContractOwner();
        VaultState storage vaultState = diamondStorage();
        vaultState.paused = true;
    }

    /// @dev Unpauses the contract to allow certain functions
    /// @notice Restricted access function, should be called by owner only
    function unpause() internal whenPaused {
        LibDiamond.enforceIsContractOwner();
        VaultState storage vaultState = diamondStorage();
        vaultState.paused = false;
    }

    /// @dev Allows lender to deposit whitelisted tokens into vault
    /// @notice Throws error if lender is not KYB verified
    /// @param _roleId LenderId of given user
    /// @param _token Address of stable coin
    /// @param _amount Amount of payment token to deposit
    function deposit(string calldata _roleId, address _token, uint256 _amount) internal whenNotPaused returns (string memory) {
        LenderLib.enforceIsLender(_roleId);
        LenderLib.enforceIsLenderKYBVerified(_roleId);
        VaultState storage vaultState = diamondStorage();
        uint256 _minAmount = (VaultLib.getMinDepositLimit() * (10 ** IERC20Metadata(_token).decimals())) / 1000000;
        if(_amount == 0 || _amount < _minAmount) {
            revert InvalidAmount(_amount);
        }
        if(!StableCoinLib.isWhitelistedToken(_token)) {
            revert InvalidPoolToken(_token);
        }
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        vaultState.isVaultCall = true;
        string memory _paymentId = PaymentLib.addPayment(_roleId, new string(0), PaymentLib.PaymentType.DEPOSIT, msg.sender, address(this), _amount);
        LenderLib.addPaymentId(_roleId, _paymentId);
        if(_token == vaultState.paymentToken) {
            vaultState.vaultBalance[_roleId] += _amount;
        } else {
            StableCoinLib.increaseBalance(_roleId, _token, _amount);
            StableCoinLib.addPaymentStableCoin(_paymentId, _token);
        }
        vaultState.isVaultCall = false;
        return _paymentId;
    }

    /// @dev Allows lender to invest into given pool
    /// @param _roleId LenderId of given user
    /// @param _poolId PoolId of the credit pool to which user wants to invest in
    /// @param _amount Amount of payment token to invest 
    function invest(string calldata _roleId, string calldata _poolId, uint256 _amount) internal whenNotPaused {
        LenderLib.enforceIsLender(_roleId);
        LenderLib.enforceIsLenderKYBVerified(_roleId);
        CreditPoolLib.enforceIsActivePool(_poolId);
        CreditPoolLib.enforcePoolIsNotExpired(_poolId);
        VaultState storage vaultState = diamondStorage();
        uint256 _balance = getTokenBalance(_roleId, StableCoinLib.getPoolToken(_poolId));
        if(
            _amount == 0 ||
            _amount > _balance ||
            _amount + vaultState.borrowedAmount[_poolId] > CreditPoolLib.getCreditPoolBorrowingAmount(_poolId)
        ) {
            revert InvalidAmount(_amount);
        }
        if(vaultState.pendingRequest[_roleId].isPending) {
            revert PendingRequestExist(_roleId);
        }
        vaultState.isVaultCall = true;
        string memory _paymentId = PaymentLib.addPayment(
            _roleId,
            _poolId,
            PaymentLib.PaymentType.INVESTMENT,
            msg.sender,
            address(this),
            _amount
        );
        LenderLib.addPaymentId(_roleId, _paymentId);
        CreditPoolLib.addPaymentId(_poolId, _paymentId);
        CreditPoolLib.addLenderId(_poolId, _roleId);
        if(StableCoinLib.getPoolToken(_poolId) == vaultState.paymentToken) {
            vaultState.vaultBalance[_roleId] -= _amount;
        } else {
            StableCoinLib.decreaseBalance(_roleId, StableCoinLib.getPoolToken(_poolId), _amount);
        }
        vaultState.isVaultCall = false;
        vaultState.vaultBalance[_poolId] += _amount;
        vaultState.borrowedAmount[_poolId] += _amount;
    }

    /// @dev Distributes pool payment to lender who invested into the pool
    /// @notice Ristricted access function, should be called by distribute facet only 
    /// @param _roleId LenderId of user to distribute
    /// @param _poolId PoolId of credit pool from which payment is being distributed
    /// @param _paymentInfo Payment details with breakdown that is being distributed
    function distribute(
        string calldata _roleId,
        string calldata _poolId,
        PaymentInfo[] calldata _paymentInfo
    ) internal whenNotPaused {
        DistributeLib.enforceIsDistribute();
        VaultState storage vaultState = diamondStorage();
        LenderLib.enforceIsLender(_roleId);
        LenderLib.enforceIsLenderKYBVerified(_roleId);
        CreditPoolLib.enforceIsLenderBoundWithPool(_roleId, _poolId);
        uint256 _amount;
        vaultState.isVaultCall = true;
        for(uint i = 0; i < _paymentInfo.length; i++) {
            if(_paymentInfo[i].amount == 0) revert InvalidAmount(_paymentInfo[i].amount);
            if(
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.INVESTMENT ||
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.DEPOSIT ||
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.WITHDRAW ||
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.FEE
            ) {
                revert InvalidPaymentType(_paymentInfo[i].paymentType);
            }
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                _poolId,
                _paymentInfo[i].paymentType,
                address(this),
                msg.sender,
                _paymentInfo[i].amount
            );
            LenderLib.addPaymentId(_roleId, _paymentId);
            CreditPoolLib.addPaymentId(_poolId, _paymentId);
            if(_paymentInfo[i].paymentType == PaymentLib.PaymentType.EXIT) {
                CreditPoolLib.removeLenderId(_poolId, _roleId);
                emit Exit(_roleId, _poolId, _paymentInfo[i].amount);
            }
            _amount += _paymentInfo[i].amount;
        }
        if(_amount > StableCoinLib.getPaidBalance(_poolId)) revert InvalidAmount(_amount);
        StableCoinLib.decreasePaidBalance(_poolId, _amount);
        if(StableCoinLib.getPoolToken(_poolId) == vaultState.paymentToken) {
            vaultState.vaultBalance[_roleId] += _amount;
        } else {
            StableCoinLib.increaseBalance(_roleId, StableCoinLib.getPoolToken(_poolId), _amount);
        }
        vaultState.isVaultCall = false;
    }

    /// @dev Withdraws given amount from vault if eligible, registers a request otherwise
    /// @param _roleId LenderId of given user
    /// @param _token Address of whitelisted stable coin
    /// @param _amount Amount of stable coin to withdraw from vault
    function withdrawRequest(string calldata _roleId, address _token, uint256 _amount) internal whenNotPaused returns(bool _isWithdrawn) {
        LenderLib.enforceIsLender(_roleId);
        LenderLib.enforceIsLenderKYBVerified(_roleId);
        VaultState storage vaultState = diamondStorage();
        uint256 _balance = getTokenBalance(_roleId, _token);
        if(_amount == 0 || _amount > _balance) {
            revert InvalidAmount(_amount);
        }
        vaultState.isVaultCall = true;
        uint256 _threshold = (StableCoinLib.getLenderThreshold() * (10 ** IERC20Metadata(_token).decimals())) / 1000000;
        if(
            (_amount <= _threshold) && 
            (block.timestamp > StableCoinLib.getLenderCoolingTime() + StableCoinLib.getLastWithdrawalTimeStamp(_roleId))
        ) {
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                new string(0),
                PaymentLib.PaymentType.WITHDRAW,
                address(this),
                msg.sender,
                _amount
            );
            LenderLib.addPaymentId(_roleId, _paymentId);
            if(_token == vaultState.paymentToken) {
                vaultState.vaultBalance[_roleId] -= _amount;
            } else {
                StableCoinLib.decreaseBalance(_roleId, _token, _amount);
                StableCoinLib.addPaymentStableCoin(_paymentId, _token);
            }
            StableCoinLib.updateLastWithdrawalTimeStamp(_roleId, uint64(block.timestamp));
            IERC20(_token).safeTransfer(msg.sender, _amount);
            _isWithdrawn = true;    
        } else {
            if(vaultState.pendingRequest[_roleId].isPending) {
                revert PendingRequestExist(_roleId);
            }
            uint256 _reqIndex = vaultState.requests.length;
            vaultState.requests.push(Request(_roleId, new string(0), msg.sender, RequestType.WITHDRAW, _amount));
            StableCoinLib.addRequestedToken(msg.sender, _token);
            vaultState.pendingRequest[_roleId] = RequestStatus(true, _reqIndex);
        }
        vaultState.isVaultCall = false;
    }

    /// @dev Processes withdraw request of lender
    /// @notice Restricted access function, should be called by an address with withdraw manager role
    /// @param _reqIndex Request index to process
    /// @param _isApproved True / False to accept / reject request
    function processWithdrawRequest(uint256 _reqIndex, bool _isApproved) internal {
        AccessControlLib.enforceIsWithdrawManager();
        VaultState storage vaultState = diamondStorage();
        if(vaultState.requests[_reqIndex].requestType != RequestType.WITHDRAW) {
            revert InvalidRequestIndex(_reqIndex);
        }
        Request memory _request = vaultState.requests[_reqIndex];
        if(_isApproved) {
            LenderLib.enforceIsLenderKYBVerified(_request.roleId);
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _request.roleId,
                _request.poolId,
                PaymentLib.PaymentType.WITHDRAW,
                address(this),
                _request.wallet,
                _request.amount
            );
            LenderLib.addPaymentId(_request.roleId, _paymentId);
            address _token = StableCoinLib.getRequestedToken(_request.wallet);
            if(_token == vaultState.paymentToken) {
                vaultState.vaultBalance[_request.roleId] -= _request.amount;
            } else {
                StableCoinLib.decreaseBalance(_request.roleId, _token, _request.amount);
                StableCoinLib.addPaymentStableCoin(_paymentId, _token);
            }
            vaultState.isVaultCall = false;
            IERC20(_token).safeTransfer(_request.wallet, _request.amount);
        }
        uint256 _lastReqIndex = vaultState.requests.length - 1;
        if(_reqIndex != _lastReqIndex) {
            vaultState.requests[_reqIndex] = vaultState.requests[_lastReqIndex];
            vaultState.pendingRequest[vaultState.requests[_lastReqIndex].roleId].requestIndex = _reqIndex;
        }
        vaultState.requests.pop();
        delete vaultState.pendingRequest[_request.roleId];
    }

    /// @dev Withdraws given amount from pool if eligible, registers a request otherwise
    /// @param _roleId PoolManagerId of given user
    /// @param _poolId PoolId of credit pool from which pool manager wants to withdraw funds
    /// @param _amount Amount of payment token to withdraw from given pool
    function receiveInvestmentRequest(string calldata _roleId, string calldata _poolId, uint256 _amount) internal whenNotPaused returns(bool _isWithdrawn) {
        CreditPoolLib.enforceIsPoolManagerBoundWithPool(_roleId, _poolId);
        PoolManagerLib.enforceIsPoolManager(_roleId);
        PoolManagerLib.enforceIsPoolManagerKYBVerified(_roleId);
        CreditPoolLib.enforceIsActivePool(_poolId);
        VaultState storage vaultState = diamondStorage();
        if(_amount == 0 || _amount > vaultState.vaultBalance[_poolId]) {
            revert InvalidAmount(_amount);
        }
        vaultState.isVaultCall = true;
        uint256 _threshold = (StableCoinLib.getPoolThreshold() * (10 ** IERC20Metadata(StableCoinLib.getPoolToken(_poolId)).decimals())) / 1000000;
        if(
            (_amount <= _threshold) && 
            (block.timestamp > StableCoinLib.getPoolCoolingTime() + StableCoinLib.getLastWithdrawalTimeStamp(_poolId))
        ) {
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                _poolId,
                PaymentLib.PaymentType.WITHDRAW,
                address(this),
                msg.sender,
                _amount
            );
            PoolManagerLib.addPaymentId(_roleId, _paymentId);
            CreditPoolLib.addPaymentId(_poolId, _paymentId);
            vaultState.vaultBalance[_poolId] -= _amount;
            address _token = StableCoinLib.getPoolToken(_poolId);
            StableCoinLib.updateLastWithdrawalTimeStamp(_poolId, uint64(block.timestamp));
            IERC20(_token).safeTransfer(msg.sender, _amount);
            _isWithdrawn = true;
        } else {
            if(vaultState.pendingRequest[_roleId].isPending) {
                revert PendingRequestExist(_roleId);
            }
            uint256 _reqIndex = vaultState.requests.length;
            vaultState.requests.push(Request(_roleId, _poolId, msg.sender, RequestType.RECEIVE, _amount));
            vaultState.pendingRequest[_roleId] = RequestStatus(true, _reqIndex);
        }
        vaultState.isVaultCall = false;
    }

    /// @dev Processes withdraw request of pool manager
    /// @notice Restricted access function, should be called by an address with withdraw manager role
    /// @param _reqIndex Request index to process
    /// @param _isApproved True / False to accept / reject request
    function processReceiveInvestmentRequest(uint256 _reqIndex, bool _isApproved) internal {
        AccessControlLib.enforceIsWithdrawManager();
        VaultState storage vaultState = diamondStorage();
        if(vaultState.requests[_reqIndex].requestType != RequestType.RECEIVE) {
            revert InvalidRequestIndex(_reqIndex);
        }
        Request memory _request = vaultState.requests[_reqIndex];
        if(_isApproved) {
            PoolManagerLib.enforceIsPoolManagerKYBVerified(_request.roleId);
            CreditPoolLib.enforceIsActivePool(_request.poolId);
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _request.roleId,
                _request.poolId,
                PaymentLib.PaymentType.WITHDRAW,
                address(this),
                _request.wallet,
                _request.amount
            );
            PoolManagerLib.addPaymentId(_request.roleId, _paymentId);
            CreditPoolLib.addPaymentId(_request.poolId, _paymentId);
            vaultState.isVaultCall = false;
            vaultState.vaultBalance[_request.poolId] -= _request.amount;
            address _token = StableCoinLib.getPoolToken(_request.poolId);
            IERC20(_token).safeTransfer(_request.wallet, _request.amount);
        }
        uint256 _lastReqIndex = vaultState.requests.length - 1;
        if(_reqIndex != _lastReqIndex) {
            vaultState.requests[_reqIndex] = vaultState.requests[_lastReqIndex];
            vaultState.pendingRequest[vaultState.requests[_lastReqIndex].roleId].requestIndex = _reqIndex;
        }
        vaultState.requests.pop();
        delete vaultState.pendingRequest[_request.roleId];
    }

    /// @dev Allows pool manager to pay payment tokens to credit pool
    /// @param _roleId PoolManagerId of given user
    /// @param _poolId PoolId of credit pool to pay for
    /// @param _paymentInfo Payment details with breakdown that is being paid to given pool
    function pay(
        string calldata _roleId,
        string calldata _poolId,
        PaymentInfo[] calldata _paymentInfo
    ) internal whenNotPaused {
        CreditPoolLib.enforceIsPoolManagerBoundWithPool(_roleId, _poolId);
        PoolManagerLib.enforceIsPoolManager(_roleId);
        PoolManagerLib.enforceIsPoolManagerKYBVerified(_roleId);
        CreditPoolLib.enforceIsActivePool(_poolId);
        VaultState storage vaultState = diamondStorage();
        uint256 _amount;
        vaultState.isVaultCall = true;
        address _token = StableCoinLib.getPoolToken(_poolId);
        for(uint i = 0; i < _paymentInfo.length; i++) {
            if(_paymentInfo[i].amount == 0) revert InvalidAmount(_paymentInfo[i].amount);
            if(
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.INVESTMENT ||
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.DEPOSIT ||
                _paymentInfo[i].paymentType == PaymentLib.PaymentType.WITHDRAW
            ) {
                revert InvalidPaymentType(_paymentInfo[i].paymentType);
            }
            string memory _paymentId;
            if(_paymentInfo[i].paymentType == PaymentLib.PaymentType.FEE) {
                _paymentId = PaymentLib.addPayment(_roleId, _poolId, PaymentLib.PaymentType.FEE, msg.sender, LibDiamond.contractOwner(), _paymentInfo[i].amount);
                IERC20(_token).safeTransfer(LibDiamond.contractOwner(), _paymentInfo[i].amount);
                emit Fee(_poolId, _paymentInfo[i].amount);
            } else {
                _paymentId = PaymentLib.addPayment(_roleId, _poolId, _paymentInfo[i].paymentType, msg.sender, address(this), _paymentInfo[i].amount);
                _amount += _paymentInfo[i].amount;
            }
            PoolManagerLib.addPaymentId(_roleId, _paymentId);
            CreditPoolLib.addPaymentId(_poolId, _paymentId);
        }
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        StableCoinLib.increasePaidBalance(_poolId, _amount);
        vaultState.isVaultCall = false;
    }

    /// @dev Adjusts vault balance of lender / paid balance of pool case of correction
    /// @notice Restricted access function, should be called by an owner only
    /// @param _id LenderId / PoolId of a vault account
    /// @param _amount Amount of payment token to adjust
    /// @param _account Account type of given id
    /// @param _type Type of adjustment (deposit / withdraw) 
    function adjustVaultBalance(
        string calldata _id,
        uint256 _amount,
        AccountType _account,
        PaymentLib.PaymentType _type
    ) internal {
        LibDiamond.enforceIsContractOwner();
        VaultState storage vaultState = diamondStorage();
        if(_amount == 0) revert InvalidAmount(_amount);
        string memory _roleId = _account == AccountType.LENDER ? _id : new string(0);
        string memory _poolId = _account == AccountType.POOL ? _id : new string(0);
        if(_type == PaymentLib.PaymentType.DEPOSIT) {
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                _poolId,
                _type,
                msg.sender,
                address(this),
                _amount
            );
            if (_account == AccountType.LENDER) {
                LenderLib.addPaymentId(_id, _paymentId);
                vaultState.vaultBalance[_id] += _amount;
            } else {
                CreditPoolLib.addPaymentId(_id, _paymentId);
                StableCoinLib.increasePaidBalance(_id, _amount);
            } 
            vaultState.isVaultCall = false;
        }
        if(_type == PaymentLib.PaymentType.WITHDRAW) {
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                _poolId,
                _type,
                address(this),
                msg.sender,
                _amount
            );
            if (_account == AccountType.LENDER) {
                LenderLib.addPaymentId(_id, _paymentId);
                vaultState.vaultBalance[_id] -= _amount;
            } else {
                CreditPoolLib.addPaymentId(_id, _paymentId);
                StableCoinLib.decreasePaidBalance(_id, _amount);
            }
            vaultState.isVaultCall = false;
        }
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
    ) internal {
        LibDiamond.enforceIsContractOwner();
        LenderLib.enforceIsLenderKYBVerified(_roleId);
        VaultState storage vaultState = diamondStorage();
        if(_amount == 0) revert InvalidAmount(_amount);
        if(!StableCoinLib.isWhitelistedToken(_token)) {
            revert InvalidPoolToken(_token);
        }
        if(_token == vaultState.paymentToken) {
            revert InvalidFunction();
        }
        if(_type == PaymentLib.PaymentType.DEPOSIT) {
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                new string(0),
                _type,
                msg.sender,
                address(this),
                _amount
            );
            LenderLib.addPaymentId(_roleId, _paymentId);
            StableCoinLib.increaseBalance(_roleId, _token, _amount);
            StableCoinLib.addPaymentStableCoin(_paymentId, _token);
            vaultState.isVaultCall = false;
        }
        if(_type == PaymentLib.PaymentType.WITHDRAW) {
            vaultState.isVaultCall = true;
            string memory _paymentId = PaymentLib.addPayment(
                _roleId,
                new string(0),
                _type,
                address(this),
                msg.sender,
                _amount
            );
            LenderLib.addPaymentId(_roleId, _paymentId);
            StableCoinLib.decreaseBalance(_roleId, _token, _amount);
            StableCoinLib.addPaymentStableCoin(_paymentId, _token);
            vaultState.isVaultCall = false;
        }
    }

    /// @dev Withdraws ERC20 token from contract in case of emergency
    /// @notice Restricted access function, should be called by an owner only
    /// @param _token Address of ERC20 token to withdraw
    /// @param _to Address of receiver
    /// @param _amount Amount of ERC20 token to withdraw from contract 
    function emergencyWithdraw(address _token, address _to, uint256 _amount) internal {
        LibDiamond.enforceIsContractOwner();
        if(_amount == 0) revert InvalidAmount(_amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }

    /// @dev Throws error if called by other than vault library
    function enforceIsVault() internal view {
        VaultState storage vaultState = diamondStorage();
        if(!vaultState.isVaultCall) {
            revert NotVaultCall();
        }
    }

    /// @dev Throws error if contract is not paused
    function requireNotPaused() internal view {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /// @dev Throws error if contract is paused
    function requirePaused() internal view {
        if (!paused()) {
            revert ExpectedPause();
        }
    }    
}

/// @title Vault facet
contract VaultFacet {
    event Adjust(string indexed id, uint256 amount, VaultLib.AccountType account, PaymentLib.PaymentType paymentType);
    event Deposit(string indexed roleId, uint256 amount);
    event DepositStableCoin(string indexed roleId, address token, uint256 amount);
    event Invest(string indexed roleId, string poolId, uint256 amount);
    event Withdraw(string indexed roleId, uint256 amount);
    event WithdrawStableCoin(string indexed roleId, address token, uint256 amount);
    event WithdrawRequest(string indexed roleId, address token, uint256 amount);
    event Receive(string indexed roleId, string poolId, uint256 amount);
    event ReceiveRequest(string indexed roleId, string poolId, uint256 amount);
    event Pay(string indexed roleId, string poolId, VaultLib.PaymentInfo[] paymentInfo);
    event Paused(address account);
    event Unpaused(address account);
    
    /// @dev Returns balance of given vault account
    /// @param _roleId RoleId associated with given vault account  
    function getVaultBalance(string calldata _roleId) external view returns (uint256) {
        return VaultLib.getVaultBalance(_roleId);
    }

    /// @dev Returns stable coin balance of given vault account
    /// @param _roleId RoleId associated with given vault account
    /// @param _token Address of stable coin  
    function getTokenBalance(string calldata _roleId, address _token) external view returns (uint256) {
        return VaultLib.getTokenBalance(_roleId, _token);
    }

    /// @dev Returns amount already borrowed by given pool
    /// @param _poolId PoolId associated with given pool
    function getBorrowedAmount(string calldata _poolId) external view returns (uint256) {
        return VaultLib.getBorrowedAmount(_poolId);
    }

    /// @dev Returns minimum amount that needs to be deposited 
    function getMinDepositLimit() external view returns (uint256) {
        return VaultLib.getMinDepositLimit();
    }

    /// @dev Returns contract address of payment token
    function getPaymentToken() external view returns (address) {
        return VaultLib.getPaymentToken();
    }

    /// @dev Returns request status of given user
    /// @param _roleId LenderId / PoolManagerId of given user
    function getRequestStatus(string calldata _roleId) external view returns (VaultLib.RequestStatus memory) {
        return VaultLib.getRequestStatus(_roleId);
    }

    /// @dev Returns request list
    function getRequests() external view returns (VaultLib.Request[] memory) {
        return VaultLib.getRequests();
    }

    /// @dev Returns request data associated with request index
    /// @param _reqIndex Request index to query for data
    function getRequestByIndex(uint256 _reqIndex) external view returns (VaultLib.Request memory) {
        return VaultLib.getRequestByIndex(_reqIndex);
    }

    /// @dev Returns number of requests registered so far 
    function getRequestsLength() external view returns (uint256) {
        return VaultLib.getRequestsLength();
    }

    /// @dev Returns true if contract is paused for certain operations
    function paused() external view returns (bool) {
        return VaultLib.paused();
    }

    /// @dev Initializes payment token address
    /// @notice This function can be called only once, throws error if the address is already set
    /// @notice Restricted access function, should be called by owner only
    /// @param _token Address of payment token
    function initializePaymentToken(address _token) external {
        return VaultLib.initializePaymentToken(_token);
    }

    /// @dev Sets minimum deposit limit
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _limit New limit to set
    function setMinDepositLimit(uint256 _limit) external {
        return VaultLib.setMinDepositLimit(_limit);
    }

    /// @dev Adjusts vault balance of lender / paid balance of pool case of correction
    /// @notice Restricted access function, should be called by an owner only
    /// @param _id LenderId / PoolId of a vault account
    /// @param _amount Amount of payment token to adjust
    /// @param _account Account type of given id
    /// @param _type Type of adjustment (deposit / withdraw) 
    function adjustVaultBalance(
        string calldata _id,
        uint256 _amount,
        VaultLib.AccountType _account,
        PaymentLib.PaymentType _type
    ) external {
        VaultLib.adjustVaultBalance(_id, _amount, _account, _type);
        emit Adjust(_id, _amount, _account, _type);
    }

    /// @dev Pauses the contract to restrict certain functions
    /// @notice Restricted access function, should be called by owner only
    function pause() external {
        VaultLib.pause();
        emit Paused(msg.sender);
    }

    /// @dev Unpauses the contract to allow certain functions
    /// @notice Restricted access function, should be called by owner only
    function unpause() external {
        VaultLib.unpause();
        emit Unpaused(msg.sender);
    }

    /// @dev Allows lender to deposit whitelisted tokens into vault
    /// @notice Throws error if lender is not KYB verified
    /// @param _roleId LenderId of given user
    /// @param _token Address of stable coin
    /// @param _amount Amount of payment token to deposit
    function deposit(string calldata _roleId, address _token, uint256 _amount) external returns (string memory) {
        if(_token == VaultLib.getPaymentToken()) {
            emit Deposit(_roleId, _amount);
        } else {
            emit DepositStableCoin(_roleId, _token, _amount);
        }
        return VaultLib.deposit(_roleId, _token, _amount);
    }

    /// @dev Allows lender to invest into given pool
    /// @param _roleId LenderId of given user
    /// @param _poolId PoolId of the credit pool to which user wants to invest in
    /// @param _amount Amount of payment token to invest 
    function invest(string calldata _roleId, string calldata _poolId, uint256 _amount) external {
        VaultLib.invest(_roleId, _poolId, _amount);
        emit Invest(_roleId, _poolId, _amount);
    }

    /// @dev Withdraws given amount from vault if eligible, registers a request otherwise
    /// @param _roleId LenderId of given user
    /// @param _token Address of whitelisted stable coin
    /// @param _amount Amount of stable coin to withdraw from vault
    function withdrawRequest(string calldata _roleId, address _token, uint256 _amount) external returns(bool _isWithdrawn) {
        _isWithdrawn = VaultLib.withdrawRequest(_roleId, _token, _amount);
        if(_isWithdrawn) {
            if(_token == VaultLib.getPaymentToken()) {
                emit Withdraw(_roleId, _amount);
            } else {
                emit WithdrawStableCoin(_roleId, _token, _amount);
            }
        } else {
            emit WithdrawRequest(_roleId, _token, _amount);
        }
    }

    /// @dev Processes withdraw request of lender
    /// @notice Restricted access function, should be called by an address with withdraw manager role
    /// @param _reqIndex Request index to process
    /// @param _isApproved True / False to accept / reject request
    function processWithdrawRequest(uint256 _reqIndex, bool _isApproved) external {
        if(_isApproved) {
            VaultLib.Request memory _request = VaultLib.getRequestByIndex(_reqIndex);
            address _token = StableCoinLib.getRequestedToken(_request.wallet);
            if(_token == VaultLib.getPaymentToken()) {
                emit Withdraw(_request.roleId, _request.amount);
            } else {
                emit WithdrawStableCoin(_request.roleId, _token, _request.amount);
            }
        }
        VaultLib.processWithdrawRequest(_reqIndex, _isApproved);
    }

    /// @dev Withdraws given amount from pool if eligible, registers a request otherwise
    /// @param _roleId PoolManagerId of given user
    /// @param _poolId PoolId of credit pool from which pool manager wants to withdraw funds
    /// @param _amount Amount of payment token to withdraw from given pool
    function receiveInvestmentRequest(string calldata _roleId, string calldata _poolId, uint256 _amount) external returns(bool _isWithdrawn) {
        _isWithdrawn = VaultLib.receiveInvestmentRequest(_roleId, _poolId, _amount);
        if(_isWithdrawn) {
            emit Receive(_roleId, _poolId, _amount);
        } else {
            emit ReceiveRequest(_roleId, _poolId, _amount);
        }
    }

    /// @dev Processes withdraw request of pool manager
    /// @notice Restricted access function, should be called by an address with withdraw manager role
    /// @param _reqIndex Request index to process
    /// @param _isApproved True / False to accept / reject request
    function processReceiveInvestmentRequest(uint256 _reqIndex, bool _isApproved) external {
        if(_isApproved) {
            VaultLib.Request memory _request = VaultLib.getRequestByIndex(_reqIndex);
            emit Receive(_request.roleId, _request.poolId, _request.amount);
        }
        VaultLib.processReceiveInvestmentRequest(_reqIndex, _isApproved);
    }

    /// @dev Allows pool manager to pay payment tokens to credit pool
    /// @param _roleId PoolManagerId of given user
    /// @param _poolId PoolId of credit pool to pay for
    /// @param _paymentInfo Payment details with breakdown that is being paid to given pool
    function pay(
        string calldata _roleId,
        string calldata _poolId,
        VaultLib.PaymentInfo[] calldata _paymentInfo
    ) external {
        VaultLib.pay(_roleId, _poolId, _paymentInfo);
        emit Pay(_roleId, _poolId, _paymentInfo);
    }
}