// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {PoolManagerLib} from "./PoolManagerFacet.sol";
import {LenderLib} from "./LenderFacet.sol";
import {VaultLib} from "./VaultFacet.sol";
import {MetadataLib} from "./MetadataFacet.sol";
import {AccessControlLib} from "./AccessControlFacet.sol";
import {StableCoinLib} from "./StableCoinExtension.sol";

error CreditPoolIdExist(string _id);
error NotCreditPoolCall();
error PoolIsNotActive(string _id);
error PoolIsExpired(string _id);
error LenderIdsExist(uint256 _length);
error InvalidRoleOrPoolId(string roleId, string poolId);
error InvalidLenderOrPoolId(string roleId, string poolId);
error LenderBoundWithPool(string roleId, string poolId);
error InvalidPoolId(string poolId);
error InvalidAmount(uint256 amount);

/// @title Credit Pool Library
library CreditPoolLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.creditpool.storage");

    struct CreditPoolState {
        mapping(string => CreditPool) creditPools;
        mapping(string => mapping(string => Binding)) lenderBinding;
        bool isCreditPoolCall;
    }

    struct CreditPool {
        string creditPoolId;
        string poolManagerId;
        string metaHash;
        uint256 borrowingAmount;
        uint64 inceptionTime;
        uint64 expiryTime;
        uint32 curingPeriod;
        CreditRatings ratings;
        uint16 bindingIndex;
        CreditPoolStatus status;
        string[] lenderIds;
        string[] paymentIds;
    }

    struct Binding {
        bool isBound;
        uint16 lenderIndexInPool;
        uint16 poolIndexInLender;
    }

    enum CreditRatings {PENDING, AAA, AA, A, BBB, BB, B, CCC, CC, C}

    enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}

    /// @dev Returns storage position of credit pool library inside diamond
    function diamondStorage() internal pure returns (CreditPoolState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Returns on-chain attributes of given credit pool
    /// @param _poolId PoolId associated with given credit pool 
    function getCreditPool(string calldata _poolId) internal view returns (CreditPool memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId];
    }

    /// @dev Returns PoolManagerId of the manager who owns given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolManagerId(string calldata _poolId) internal view returns (string memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].poolManagerId;
    }

    /// @dev Returns IPFS hash of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolMetaHash(string calldata _poolId) internal view returns (string memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].metaHash;
    }

    /// @dev Returns pool size of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolBorrowingAmount(string memory _poolId) internal view returns (uint256) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].borrowingAmount;
    }

    /// @dev Returns credit pool inception time (Unix timestamp)
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolInceptionTime(string calldata _poolId) internal view returns (uint64) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].inceptionTime;
    }

    /// @dev Returns credit pool cut-off time (Unix timestamp)
    ///      beyond which pool won't accept new investment from lenders
    /// @param _poolId PoolId associated with given credit pool  
    function getCreditPoolExpiryTime(string calldata _poolId) internal view returns (uint64) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].expiryTime;
    }

    /// @dev Returns curing period (in seconds) of given credit pool
    /// @param _poolId PoolId associated with given credit pool 
    function getCreditPoolCuringPeriod(string calldata _poolId) internal view returns (uint32) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].curingPeriod;
    }

    /// @dev Returns credit ratings of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolRatings(string calldata _poolId) internal view returns (CreditRatings) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].ratings;
    }

    /// @dev Returns index of given credit pool in pool manager's pool list
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolBindingIndex(string calldata _poolId) internal view returns (uint16) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].bindingIndex;
    }

    /// @dev Returns credit pool status
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolStatus(string calldata _poolId) internal view returns (CreditPoolStatus) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].status;
    }

    /// @dev Returns number of active lenders associated with given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getLenderIdsLength(string calldata _poolId) internal view returns (uint256) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].lenderIds.length;
    }

    /// @dev Returns LenderId that is associated with given credit pool based on given index
    /// @param _poolId PoolId associated with given credit pool
    /// @param _index Index number to query
    function getLenderId(string calldata _poolId, uint256 _index) internal view returns (string memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].lenderIds[_index];
    }

    /// @dev Returns number if payments associated with given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getPaymentIdsLength(string calldata _poolId) internal view returns (uint256) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].paymentIds.length;
    }

    /// @dev Returns PaymentId that is associated with given credit pool based on given index
    /// @param _poolId PoolId associated with given credit pool
    /// @param _index Index number to query
    function getPaymentId(string calldata _poolId, uint256 _index) internal view returns (string memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.creditPools[_poolId].paymentIds[_index];
    }

    /// @dev Returns index of given credit pool in lender's pool list
    /// @param _lenderId LenderId associated with given lender
    /// @param _poolId PoolId associated with given credit pool
    function getLenderBinding(string calldata _lenderId, string calldata _poolId) internal view returns (Binding memory) {
        CreditPoolState storage creditPoolState = diamondStorage();
        return creditPoolState.lenderBinding[_lenderId][_poolId];
    }

    /// @dev Returns IPFS URL of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getMetadataURI(string calldata _poolId) internal view returns (string memory) {
        enforceIsCreditPoolIdExist(_poolId);
        string memory _baseURI = MetadataLib.getBaseURI();
        string memory _metaHash = getCreditPoolMetaHash(_poolId);
        return bytes(_baseURI).length > 0 ? string(string.concat(bytes(_baseURI), bytes(_metaHash))) : "";
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
    function createCreditPool(
        string calldata _creditPoolId,
        string calldata _poolManagerId,
        string calldata _metaHash,
        uint256 _borrowingAmount,
        uint64 _inceptionTime,
        uint64 _expiryTime,
        uint32 _curingPeriod,
        CreditPoolStatus _status
    ) internal returns (CreditPool memory) {
        AccessControlLib.enforceIsCreateManager();
        CreditPoolState storage creditPoolState = diamondStorage();
        if(keccak256(bytes(_creditPoolId)) == keccak256(bytes(creditPoolState.creditPools[_creditPoolId].creditPoolId))) {
            revert CreditPoolIdExist(_creditPoolId);
        }
        PoolManagerLib.enforceIsPoolManagerKYBVerified(_poolManagerId);
        creditPoolState.creditPools[_creditPoolId] = CreditPool(
            _creditPoolId,
            _poolManagerId,
            _metaHash,
            _borrowingAmount,
            _inceptionTime,
            _expiryTime,
            _curingPeriod,
            CreditRatings.PENDING,
            uint16(PoolManagerLib.getPoolIdsLength(_poolManagerId)),
            _status,
            new string[](0),
            new string[](0)
        );
        creditPoolState.isCreditPoolCall = true;
        PoolManagerLib.addPoolId(_poolManagerId, _creditPoolId);
        creditPoolState.isCreditPoolCall = false;
        return creditPoolState.creditPools[_creditPoolId];
    }

    /// @dev Deletes existing credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role
    /// @param _creditPoolId PoolId associated with credit pool
    function removeCreditPool(string calldata _creditPoolId) internal {
        AccessControlLib.enforceIsDeleteManager();
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.creditPools[_creditPoolId].lenderIds.length != 0) {
            revert LenderIdsExist(creditPoolState.creditPools[_creditPoolId].lenderIds.length);
        }
        string memory _poolManagerId = creditPoolState.creditPools[_creditPoolId].poolManagerId;
        uint16 _index = creditPoolState.creditPools[_creditPoolId].bindingIndex;
        creditPoolState.isCreditPoolCall = true;
        PoolManagerLib.removePoolIdByIndex(_poolManagerId, _index);
        StableCoinLib.deletePoolToken(_creditPoolId);
        creditPoolState.isCreditPoolCall = false;
        delete creditPoolState.creditPools[_creditPoolId];
    }

    /// @dev Updates IPFS hash of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _hash IPFS hash of credit pool
    function updateCreditPoolHash(string calldata _creditPoolId, string calldata _hash) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].metaHash = _hash;
    }

    /// @dev Updates pool size of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _borrowingAmount Pool size of given credit pool
    function updateCreditPoolBorrowingAmount(string calldata _creditPoolId, uint256 _borrowingAmount) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        if(_borrowingAmount < VaultLib.getBorrowedAmount(_creditPoolId)) {
            revert InvalidAmount(_borrowingAmount);
        }
        creditPoolState.creditPools[_creditPoolId].borrowingAmount = _borrowingAmount;
    }

    /// @dev Updates inception time of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _inceptionTime Inception time (Unix timestamp) of credit pool
    function updateCreditPoolInceptionTime(string calldata _creditPoolId, uint64 _inceptionTime) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].inceptionTime = _inceptionTime;
    }

    /// @dev Updates expiry time of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _expiryTime Cut-off time (Unix timestamp) of credit pool
    function updateCreditPoolExpiryTime(string calldata _creditPoolId, uint64 _expiryTime) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].expiryTime = _expiryTime;
    }

    /// @dev Updates curing period of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _curingPeriod Curing period (In seconds) of credit pool 
    function updateCreditPoolCuringPeriod(string calldata _creditPoolId, uint32 _curingPeriod) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].curingPeriod = _curingPeriod;
    }

    /// @dev Updates index of credit pool in pool manager's pool list
    /// @notice Called internally when pool list of pool manager gets updated
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _bindingIndex Index of credit pool to assign in pool manager's pool list
    function updateBindingIndexOfPool(string memory _creditPoolId, uint256 _bindingIndex) internal {
        enforceIsCreditPool();
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].bindingIndex = uint16(_bindingIndex);
    }

    /// @dev Updates credit ratings of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _ratings Credit ratings of given credit pool
    function updateCreditRatings(string calldata _creditPoolId, CreditRatings _ratings) internal {
        AccessControlLib.enforceIsEditManager();
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.creditPools[_creditPoolId].status != CreditPoolStatus.ACTIVE) {
            revert PoolIsNotActive(_creditPoolId);
        }
        creditPoolState.creditPools[_creditPoolId].ratings = _ratings;
    }

    /// @dev Updates status of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _status Status of given credit pool
    function updateCreditPoolStatus(string calldata _creditPoolId, CreditPoolStatus _status) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsCreditPoolIdExist(_creditPoolId);
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.creditPools[_creditPoolId].status = _status;
    }

    /// @dev Updates index of credit pool in lender's pool list
    /// @notice Called internally when pool list of lender gets updated
    /// @param _lenderId LenderId of lender whose pool list gets updated
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _poolIndexInLender Index of credit pool to assign in lender's pool list
    function updatePoolIndexInLender(
        string memory _lenderId,
        string memory _creditPoolId,
        uint256 _poolIndexInLender
    ) internal {
        enforceIsCreditPool();
        CreditPoolState storage creditPoolState = diamondStorage();
        creditPoolState.lenderBinding[_lenderId][_creditPoolId].poolIndexInLender = uint16(_poolIndexInLender);
    }

    /// @dev Adds LenderId to given credit pool's lender list
    /// @notice Called internally when lender makes a new investment
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _lenderId LenderId of lender who invested in given credit pool
    function addLenderId(string memory _creditPoolId, string memory _lenderId) internal {
        VaultLib.enforceIsVault();
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.creditPools[_creditPoolId].status != CreditPoolStatus.ACTIVE) {
            revert PoolIsNotActive(_creditPoolId);
        }
        if(!creditPoolState.lenderBinding[_lenderId][_creditPoolId].isBound) {
            uint16 _lenderIndexInPool = uint16(creditPoolState.creditPools[_creditPoolId].lenderIds.length);
            uint16 _poolIndexInLender = uint16(LenderLib.getPoolIdsLength(_lenderId));
            creditPoolState.isCreditPoolCall = true;
            LenderLib.addPoolId(_lenderId, _creditPoolId);
            creditPoolState.isCreditPoolCall = false;
            creditPoolState.creditPools[_creditPoolId].lenderIds.push(_lenderId);
            creditPoolState.lenderBinding[_lenderId][_creditPoolId] = Binding(true, _lenderIndexInPool, _poolIndexInLender);
        }
    }

    /// @dev Removes LenderId from given credit pool's lender list
    /// @notice Called internally when lender exits the pool
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _lenderId LenderId of lender who exited from given credit pool
    function removeLenderId(string memory _creditPoolId, string memory _lenderId) internal {
        VaultLib.enforceIsVault();
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.lenderBinding[_lenderId][_creditPoolId].isBound) {
            uint16 _lastLenderIndexInPool = uint16(creditPoolState.creditPools[_creditPoolId].lenderIds.length - 1);
            uint16 _lenderIndexInPool = creditPoolState.lenderBinding[_lenderId][_creditPoolId].lenderIndexInPool;
            uint16 _poolIndexInLender = creditPoolState.lenderBinding[_lenderId][_creditPoolId].poolIndexInLender;
            creditPoolState.isCreditPoolCall = true;
            LenderLib.removePoolIdByIndex(_lenderId, _poolIndexInLender);
            creditPoolState.isCreditPoolCall = false;
            if(_lenderIndexInPool != _lastLenderIndexInPool) {
                creditPoolState.creditPools[_creditPoolId].lenderIds[_lenderIndexInPool] = creditPoolState.creditPools[_creditPoolId].lenderIds[_lastLenderIndexInPool];
                string memory _lastLenderId = creditPoolState.creditPools[_creditPoolId].lenderIds[_lenderIndexInPool];
                creditPoolState.lenderBinding[_lastLenderId][_creditPoolId].lenderIndexInPool = uint16(_lenderIndexInPool);
            }
            creditPoolState.creditPools[_creditPoolId].lenderIds.pop();
            delete creditPoolState.lenderBinding[_lenderId][_creditPoolId];
        }
    }

    /// @dev Adds PaymentId associated with given credit pool
    /// @notice Called internally whenever a new payment registered to given credit pool 
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _paymentId PaymentId associated with a new payment
    function addPaymentId(string memory _creditPoolId, string memory _paymentId) internal {
        VaultLib.enforceIsVault();
        CreditPoolState storage creditPoolState = diamondStorage();
        CreditPool storage creditPool = creditPoolState.creditPools[_creditPoolId];
        creditPool.paymentIds.push(_paymentId);
    }

    /// @dev Removes PaymentId associated with given credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _paymentId PaymentId to remove
    function removePaymentId(string calldata _creditPoolId, string calldata _paymentId) internal {
        AccessControlLib.enforceIsDeleteManager();
        CreditPoolState storage creditPoolState = diamondStorage();
        CreditPool storage creditPool = creditPoolState.creditPools[_creditPoolId];
        uint256 index;
        for (uint256 i = 0; i < creditPool.paymentIds.length; i++) {
            if (keccak256(bytes(creditPool.paymentIds[i])) == keccak256(bytes(_paymentId))) {
                index = i;
                break;
            }
        }
        creditPool.paymentIds[index] = creditPool.paymentIds[creditPool.paymentIds.length - 1];
        creditPool.paymentIds.pop();
    }

    /// @dev Removes PaymentId associated with given credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _paymentIndex Index of PaymentId to remove
    function removePaymentIdByIndex(string calldata _creditPoolId, uint256 _paymentIndex) internal {
        AccessControlLib.enforceIsDeleteManager();
        CreditPoolState storage creditPoolState = diamondStorage();
        CreditPool storage creditPool = creditPoolState.creditPools[_creditPoolId];
        if(_paymentIndex != creditPool.paymentIds.length - 1) {
            creditPool.paymentIds[_paymentIndex] = creditPool.paymentIds[creditPool.paymentIds.length - 1];
        }
        creditPool.paymentIds.pop();
    }

    /// @dev Throws error if called by other than credit pool library
    function enforceIsCreditPool() internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(!creditPoolState.isCreditPoolCall) {
            revert NotCreditPoolCall();
        }
    }

    /// @dev Throws error if pool is not active
    function enforceIsActivePool(string memory _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.creditPools[_creditPoolId].status != CreditPoolStatus.ACTIVE) {
            revert PoolIsNotActive(_creditPoolId);
        }
    }

    /// @dev Throws error if pool cut-off time reached
    function enforcePoolIsNotExpired(string memory _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(block.timestamp > creditPoolState.creditPools[_creditPoolId].expiryTime) {
            revert PoolIsExpired(_creditPoolId);
        }
    }

    /// @dev Throws error if lender is not active investor of given pool
    function enforceIsLenderBoundWithPool(string calldata _lenderId, string calldata _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(!creditPoolState.lenderBinding[_lenderId][_creditPoolId].isBound) {
            revert InvalidLenderOrPoolId(_lenderId, _creditPoolId);
        }
    }

    /// @dev Throws error if lender is active investor of given pool
    function enforceLenderIsNotBoundWithPool(string calldata _lenderId, string calldata _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(creditPoolState.lenderBinding[_lenderId][_creditPoolId].isBound) {
            revert LenderBoundWithPool(_lenderId, _creditPoolId);
        }
    }

    /// @dev Throws error if pool manager is not owner of the pool
    function enforceIsPoolManagerBoundWithPool(string calldata _poolManagerId, string calldata _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(keccak256(bytes(_poolManagerId)) != keccak256(bytes(creditPoolState.creditPools[_creditPoolId].poolManagerId))) {
            revert InvalidRoleOrPoolId(_poolManagerId, _creditPoolId);
        }
    }

    /// @dev Throws error if credit pool not exist
    function enforceIsCreditPoolIdExist(string calldata _creditPoolId) internal view {
        CreditPoolState storage creditPoolState = diamondStorage();
        if(bytes(creditPoolState.creditPools[_creditPoolId].creditPoolId).length == 0) {
            revert InvalidPoolId(_creditPoolId);
        }
    }
}

// @title Credit Pool Facet
contract CreditPoolFacet {
    event CreateCreditPoolEvent(CreditPoolLib.CreditPool creditPool);
    event DeleteCreditPoolEvent(string indexed poolId);
    event UpdateCreditPoolHashEvent(string indexed poolId, string prevHash, string newHash);
    event UpdateCreditPoolBorrowingAmountEvent(string indexed poolId, uint256 prevAmount, uint256 newAmount);
    event UpdateCreditPoolInceptionTimeEvent(string indexed poolId, uint64 prevTime, uint64 newTime);
    event UpdateCreditPoolExpiryTimeEvent(string indexed poolId, uint64 prevTime, uint64 newTime);
    event UpdateCreditPoolCuringPeriodEvent(string indexed poolId, uint32 prevPeriod, uint32 newPeriod);
    event UpdateCreditRatingsEvent(
        string indexed poolId,
        CreditPoolLib.CreditRatings prevRatings,
        CreditPoolLib.CreditRatings newRatings
    );
    event UpdateCreditPoolStatusEvent(
        string indexed poolId,
        CreditPoolLib.CreditPoolStatus prevStatus,
        CreditPoolLib.CreditPoolStatus newStatus
    );

    /// @dev Returns on-chain attributes of given credit pool
    /// @param _poolId PoolId associated with given credit pool 
    function getCreditPool(string calldata _poolId) external view returns (CreditPoolLib.CreditPool memory) {
        return CreditPoolLib.getCreditPool(_poolId);
    }

    /// @dev Returns PoolManagerId of the manager who owns given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolManagerId(string calldata _poolId) external view returns (string memory) {
        return CreditPoolLib.getCreditPoolManagerId(_poolId);
    }

    /// @dev Returns IPFS hash of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolMetaHash(string calldata _poolId) external view returns (string memory) {
        return CreditPoolLib.getCreditPoolMetaHash(_poolId);
    }

    /// @dev Returns pool size of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolBorrowingAmount(string calldata _poolId) external view returns (uint256) {
        return CreditPoolLib.getCreditPoolBorrowingAmount(_poolId);
    }

    /// @dev Returns credit pool inception time (Unix timestamp)
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolInceptionTime(string calldata _poolId) external view returns (uint64) {
        return CreditPoolLib.getCreditPoolInceptionTime(_poolId);
    }

    /// @dev Returns credit pool cut-off time (Unix timestamp)
    ///      beyond which pool won't accept new investment from lenders
    /// @param _poolId PoolId associated with given credit pool  
    function getCreditPoolExpiryTime(string calldata _poolId) external view returns (uint64) {
        return CreditPoolLib.getCreditPoolExpiryTime(_poolId);
    }

    /// @dev Returns curing period (in seconds) of given credit pool
    /// @param _poolId PoolId associated with given credit pool 
    function getCreditPoolCuringPeriod(string calldata _poolId) external view returns (uint32) {
        return CreditPoolLib.getCreditPoolCuringPeriod(_poolId);
    }

    /// @dev Returns credit ratings of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolRatings(string calldata _poolId) external view returns (CreditPoolLib.CreditRatings) {
        return CreditPoolLib.getCreditPoolRatings(_poolId);
    }

    /// @dev Returns index of given credit pool in pool manager's pool list
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolBindingIndex(string calldata _poolId) external view returns (uint16) {
        return CreditPoolLib.getCreditPoolBindingIndex(_poolId);
    }

    /// @dev Returns credit pool status
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolStatus(string calldata _poolId) external view returns (CreditPoolLib.CreditPoolStatus) {
        return CreditPoolLib.getCreditPoolStatus(_poolId);
    }

    /// @dev Returns number of active lenders associated with given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolLenderIdsLength(string calldata _poolId) external view returns (uint256) {
        return CreditPoolLib.getLenderIdsLength(_poolId);
    }

    /// @dev Returns LenderId that is associated with given credit pool based on given index
    /// @param _poolId PoolId associated with given credit pool
    /// @param _index Index number to query
    function getCreditPoolLenderId(string calldata _poolId, uint256 _index) external view returns (string memory) {
        return CreditPoolLib.getLenderId(_poolId, _index);
    }

    /// @dev Returns number if payments associated with given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolPaymentIdsLength(string calldata _poolId) external view returns (uint256) {
        return CreditPoolLib.getPaymentIdsLength(_poolId);
    }

    /// @dev Returns PaymentId that is associated with given credit pool based on given index
    /// @param _poolId PoolId associated with given credit pool
    /// @param _index Index number to query
    function getCreditPoolPaymentId(string calldata _poolId, uint256 _index) external view returns (string memory) {
        return CreditPoolLib.getPaymentId(_poolId, _index);
    }

    /// @dev Returns index of given credit pool in lender's pool list
    /// @param _lenderId LenderId associated with given lender
    /// @param _poolId PoolId associated with given credit pool
    function getLenderBinding(string calldata _lenderId, string calldata _poolId) external view returns (CreditPoolLib.Binding memory) {
        return CreditPoolLib.getLenderBinding(_lenderId, _poolId);
    }

    /// @dev Returns IPFS URL of given credit pool
    /// @param _poolId PoolId associated with given credit pool
    function getCreditPoolMetadataURI(string calldata _poolId) external view returns (string memory) {
        return CreditPoolLib.getMetadataURI(_poolId);
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
    function createCreditPool(
        string calldata _creditPoolId,
        string calldata _poolManagerId,
        string calldata _metaHash,
        uint256 _borrowingAmount,
        uint64 _inceptionTime,
        uint64 _expiryTime,
        uint32 _curingPeriod,
        CreditPoolLib.CreditPoolStatus _status
    ) external {
        CreditPoolLib.CreditPool memory creditPool = CreditPoolLib.createCreditPool(_creditPoolId, _poolManagerId, _metaHash, _borrowingAmount, _inceptionTime, _expiryTime, _curingPeriod, _status);
        emit CreateCreditPoolEvent(creditPool);
    }

    /// @dev Deletes existing credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role
    /// @param _creditPoolId PoolId associated with credit pool
    function deleteCreditPool(string calldata _creditPoolId) external {
        CreditPoolLib.removeCreditPool(_creditPoolId);
        emit DeleteCreditPoolEvent(_creditPoolId);
    }

    /// @dev Updates IPFS hash of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _hash IPFS hash of credit pool
    function updateCreditPoolHash(string calldata _creditPoolId, string calldata _hash) external {
        string memory _prevHash = CreditPoolLib.getCreditPoolMetaHash(_creditPoolId);
        CreditPoolLib.updateCreditPoolHash(_creditPoolId, _hash);
        emit UpdateCreditPoolHashEvent(_creditPoolId, _prevHash, _hash);
    }

    /// @dev Updates pool size of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _amount Pool size of given credit pool
    function updateCreditPoolBorrowingAmount(string calldata _creditPoolId, uint256 _amount) external {
        uint256 _prevAmount = CreditPoolLib.getCreditPoolBorrowingAmount(_creditPoolId);
        CreditPoolLib.updateCreditPoolBorrowingAmount(_creditPoolId, _amount);
        emit UpdateCreditPoolBorrowingAmountEvent(_creditPoolId, _prevAmount, _amount);
    }

    /// @dev Updates inception time of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _time Inception time (Unix timestamp) of credit pool
    function updateCreditPoolInceptionTime(string calldata _creditPoolId, uint64 _time) external {
        uint64 _prevTime = CreditPoolLib.getCreditPoolInceptionTime(_creditPoolId);
        CreditPoolLib.updateCreditPoolInceptionTime(_creditPoolId, _time);
        emit UpdateCreditPoolInceptionTimeEvent(_creditPoolId, _prevTime, _time);
    }

    /// @dev Updates expiry time of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _time Cut-off time (Unix timestamp) of credit pool
    function updateCreditPoolExpiryTime(string calldata _creditPoolId, uint64 _time) external {
        uint64 _prevTime = CreditPoolLib.getCreditPoolExpiryTime(_creditPoolId);
        CreditPoolLib.updateCreditPoolExpiryTime(_creditPoolId, _time);
        emit UpdateCreditPoolExpiryTimeEvent(_creditPoolId, _prevTime, _time);
    }

    /// @dev Updates curing period of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _curingPeriod Curing period (In seconds) of credit pool 
    function updateCreditPoolCuringPeriod(string calldata _creditPoolId, uint32 _curingPeriod) external {
        uint32 _prevPeriod = CreditPoolLib.getCreditPoolCuringPeriod(_creditPoolId);
        CreditPoolLib.updateCreditPoolCuringPeriod(_creditPoolId, _curingPeriod);
        emit UpdateCreditPoolCuringPeriodEvent(_creditPoolId, _prevPeriod, _curingPeriod);
    }

    /// @dev Updates credit ratings of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _ratings Credit ratings of given credit pool
    function updateCreditRatings(string calldata _creditPoolId, CreditPoolLib.CreditRatings _ratings) external {
        CreditPoolLib.CreditRatings _prevRatings = CreditPoolLib.getCreditPoolRatings(_creditPoolId);
        CreditPoolLib.updateCreditRatings(_creditPoolId, _ratings);
        emit UpdateCreditRatingsEvent(_creditPoolId, _prevRatings, _ratings);
    }

    /// @dev Updates status of given credit pool
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _status Status of given credit pool
    function updateCreditPoolStatus(string calldata _creditPoolId, CreditPoolLib.CreditPoolStatus _status) external {
        CreditPoolLib.CreditPoolStatus _prevStatus = CreditPoolLib.getCreditPoolStatus(_creditPoolId);
        CreditPoolLib.updateCreditPoolStatus(_creditPoolId, _status);
        emit UpdateCreditPoolStatusEvent(_creditPoolId, _prevStatus, _status);
    }

    /// @dev Removes PaymentId associated with given credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _paymentId PaymentId to remove
    function removeCreditPoolPaymentId(string calldata _creditPoolId, string calldata _paymentId) external {
        CreditPoolLib.removePaymentId(_creditPoolId, _paymentId);
    }

    /// @dev Removes PaymentId associated with given credit pool
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _creditPoolId PoolId associated with credit pool
    /// @param _paymentIndex Index of PaymentId to remove
    function removeCreditPoolPaymentIdByIndex(string calldata _creditPoolId, uint256 _paymentIndex) external {
        CreditPoolLib.removePaymentIdByIndex(_creditPoolId, _paymentIndex);
    }
}