// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {CreditPoolLib} from "./CreditPoolFacet.sol";
import {VaultLib} from "./VaultFacet.sol";
import {MetadataLib} from "./MetadataFacet.sol";
import {AccessControlLib} from "./AccessControlFacet.sol";

error NotLender(address _user, address _lender);
error LenderIdExist(string _id);
error PoolIdsExist(uint256 _length);
error NotVerifiedLender(string _id);
error InvalidLenderId(string _id);

/// @title Lender library
library LenderLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.lender.storage");

    struct LenderState {
        mapping(string => Lender) lenders;
    }

    struct Lender {
        string lenderId;
        string userId;
        string metaHash;
        string country;
        uint64 onBoardTime;
        address wallet;
        KYBStatus status;
        string[] poolIds;
        string[] paymentIds;
    }

    enum KYBStatus {PENDING, VERIFIED, REJECTED}

    /// @dev Returns storage position of lender library inside diamond
    function diamondStorage() internal pure returns (LenderState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Returns on-chain attributes of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLender(string calldata _lenderId) internal view returns (Lender memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId];
    }

    /// @dev Returns userId of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderUserId(string calldata _lenderId) internal view returns (string memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].userId;
    }

    /// @dev Returns IPFS hash of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderMetaHash(string calldata _lenderId) internal view returns (string memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].metaHash;
    }

    /// @dev Returns country of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderCountry(string calldata _lenderId) internal view returns (string memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].country;
    }

    /// @dev Returns onboarding time (Unix timestamp) of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderOnBoardTime(string calldata _lenderId) internal view returns (uint64) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].onBoardTime;
    }

    /// @dev Returns wallet address of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderWallet(string calldata _lenderId) internal view returns (address) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].wallet;
    }

    /// @dev Returns KYB status of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderKYBStatus(string calldata _lenderId) internal view returns (KYBStatus) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].status;
    }

    /// @dev Returns number of active pools for given lender
    /// @param _lenderId LenderId associated with given lender
    function getPoolIdsLength(string memory _lenderId) internal view returns (uint256) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].poolIds.length;
    }

    /// @dev Returns PoolId associated with given lender at given index
    /// @param _lenderId LenderId associated with given lender
    /// @param _index Index number to query
    function getPoolId(string calldata _lenderId, uint256 _index) internal view returns (string memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].poolIds[_index];
    }

    /// @dev Returns all PoolIds associated with given lender
    /// @param _lenderId LenderId associated with given lender
    function getPoolIds(string calldata _lenderId) internal view returns (string[] memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].poolIds;
    }

    /// @dev Returns number of payments associated with given lender
    /// @param _lenderId LenderId associated with given lender
    function getPaymentIdsLength(string calldata _lenderId) internal view returns (uint256) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].paymentIds.length;
    }

    /// @dev Returns PaymentId that is associated with given lender at given index
    /// @param _lenderId LenderId associated with given lender
    /// @param _index Index number to query
    function getPaymentId(string calldata _lenderId, uint256 _index) internal view returns (string memory) {
        LenderState storage lenderState = diamondStorage();
        return lenderState.lenders[_lenderId].paymentIds[_index];
    }

    /// @dev Returns IPFS URL of given Lender
    /// @param _lenderId LenderId associated with given lender
    function getMetadataURI(string calldata _lenderId) internal view returns (string memory) {
        enforceIsLenderIdExist(_lenderId);
        string memory _baseURI = MetadataLib.getBaseURI();
        string memory _metaHash = getLenderMetaHash(_lenderId);
        return bytes(_baseURI).length > 0 ? string(string.concat(bytes(_baseURI), bytes(_metaHash))) : "";
    }

    /// @dev Creates a new lender
    /// @notice Restricted access function, should be called by an address with create manager role
    /// @param _lenderId RoleId associated with lender
    /// @param _userId UserId associated with lender
    /// @param _metaHash IPFS has of lender
    /// @param _country Country code of lender
    /// @param _onBoardTime On-boarding time (Unix timestamp) of lender
    /// @param _wallet Wallet address of lender
    /// @param _status KYB status of lender 
    function createLender(
        string calldata _lenderId,
        string calldata _userId,
        string calldata _metaHash,
        string calldata _country,
        uint64 _onBoardTime,
        address _wallet,
        KYBStatus _status
    ) internal returns (Lender memory) {
        AccessControlLib.enforceIsCreateManager();
        LenderState storage lenderState = diamondStorage();
        if(keccak256(bytes(_lenderId)) == keccak256(bytes(lenderState.lenders[_lenderId].lenderId))) {
            revert LenderIdExist(_lenderId);
        }
        lenderState.lenders[_lenderId] = Lender(_lenderId, _userId, _metaHash, _country, _onBoardTime, _wallet, _status, new string[](0), new string[](0));
        return lenderState.lenders[_lenderId];
    }

    /// @dev Deletes existing lender
    /// @notice Restricted access function, should be called by an address with delete manager role
    /// @param _lenderId LenderId to delete
    function removeLender(string calldata _lenderId) internal {
        AccessControlLib.enforceIsDeleteManager();
        LenderState storage lenderState = diamondStorage();
        if(lenderState.lenders[_lenderId].poolIds.length != 0) {
            revert PoolIdsExist(lenderState.lenders[_lenderId].poolIds.length);
        }
        delete lenderState.lenders[_lenderId];
    }

    /// @dev Updates IPFS hash of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _hash New IPFS hash to set 
    function updateLenderHash(string calldata _lenderId, string calldata _hash) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsLenderIdExist(_lenderId);
        LenderState storage lenderState = diamondStorage();
        lenderState.lenders[_lenderId].metaHash = _hash;
    }

    /// @dev Updates country of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _country New country to set
    function updateLenderCountry(string calldata _lenderId, string calldata _country) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsLenderIdExist(_lenderId);
        LenderState storage lenderState = diamondStorage();
        lenderState.lenders[_lenderId].country = _country;
    }

    /// @dev Updates on-boarding time (Unix timestamp) of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _onBoardTime New on-board time (Unix timestamp) to set
    function updateLenderOnBoardTime(string calldata _lenderId, uint64 _onBoardTime) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsLenderIdExist(_lenderId);
        LenderState storage lenderState = diamondStorage();
        lenderState.lenders[_lenderId].onBoardTime = _onBoardTime;
    }

    /// @dev Updates wallet address of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _wallet New wallet address to set
    function updateLenderWallet(string calldata _lenderId, address _wallet) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsLenderIdExist(_lenderId);
        LenderState storage lenderState = diamondStorage();
        lenderState.lenders[_lenderId].wallet = _wallet;
    }

    /// @dev Updates KYB status of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _status KYB status to set  
    function updateLenderKYB(string calldata _lenderId, KYBStatus _status) internal {
        AccessControlLib.enforceIsEditManager();
        enforceIsLenderIdExist(_lenderId);
        LenderState storage lenderState = diamondStorage();
        lenderState.lenders[_lenderId].status = _status;
    }

    /// @dev Adds PoolId to given lender's pool list
    /// @notice Called internally whenever lender invests for first time in given pool
    /// @param _lenderId LenderId associated with given lender
    /// @param _poolId PoolId in which lender has invested for first time
    function addPoolId(string memory _lenderId, string memory _poolId) internal {
        CreditPoolLib.enforceIsCreditPool();
        LenderState storage lenderState = diamondStorage();
        Lender storage lender = lenderState.lenders[_lenderId];
        lender.poolIds.push(_poolId);
    }

    /// @dev Removes PoolId from given lender's pool list based on given index
    /// @notice Called internally whenever lender exits from given pool
    /// @param _lenderId LenderId associated with given lender
    /// @param _poolIndex Index of pool to remove from lender's pool list
    function removePoolIdByIndex(string memory _lenderId, uint256 _poolIndex) internal {
        CreditPoolLib.enforceIsCreditPool();
        LenderState storage lenderState = diamondStorage();
        Lender storage lender = lenderState.lenders[_lenderId];
        if(_poolIndex != lender.poolIds.length - 1) {
            lender.poolIds[_poolIndex] = lender.poolIds[lender.poolIds.length - 1];
            string memory _poolId = lender.poolIds[_poolIndex];
            CreditPoolLib.updatePoolIndexInLender(_lenderId, _poolId, _poolIndex);
        }
        lender.poolIds.pop();
    }
    
    /// @dev Adds PaymentId associated with given lender
    /// @notice Called internally whenever a new payment registered that is associated with given lender 
    /// @param _lenderId LenderId associated with given lender
    /// @param _paymentId PaymentId associated with a new payment
    function addPaymentId(string memory _lenderId, string memory _paymentId) internal {
        VaultLib.enforceIsVault();
        LenderState storage lenderState = diamondStorage();
        Lender storage lender = lenderState.lenders[_lenderId];
        lender.paymentIds.push(_paymentId);
    }

    /// @dev Removes PaymentId associated with given lender
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _lenderId LenderId associated with given lender
    /// @param _paymentId PaymentId to remove
    function removePaymentId(string calldata _lenderId, string calldata _paymentId) internal {
        AccessControlLib.enforceIsDeleteManager();
        LenderState storage lenderState = diamondStorage();
        Lender storage lender = lenderState.lenders[_lenderId];
        uint256 index;
        for (uint256 i = 0; i < lender.paymentIds.length; i++) {
            if (keccak256(bytes(lender.paymentIds[i])) == keccak256(bytes(_paymentId))) {
                index = i;
                break;
            }
        }
        lender.paymentIds[index] = lender.paymentIds[lender.paymentIds.length - 1];
        lender.paymentIds.pop();
    }

    /// @dev Removes PaymentId associated with given lender based on given index
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _lenderId LenderId associated with given lender
    /// @param _paymentIndex Index of PaymentId to remove
    function removePaymentIdByIndex(string calldata _lenderId, uint256 _paymentIndex) internal {
        AccessControlLib.enforceIsDeleteManager();
        LenderState storage lenderState = diamondStorage();
        Lender storage lender = lenderState.lenders[_lenderId];
        if(_paymentIndex != lender.paymentIds.length - 1) {
            lender.paymentIds[_paymentIndex] = lender.paymentIds[lender.paymentIds.length - 1];
        }
        lender.paymentIds.pop();
    }

    /// @dev Throws error if called by other than lender
    function enforceIsLender(string calldata _lenderId) internal view {
        LenderState storage lenderState = diamondStorage();
        if(msg.sender != lenderState.lenders[_lenderId].wallet) {
            revert NotLender(msg.sender, lenderState.lenders[_lenderId].wallet);
        }
    }

    /// @dev Throws error if lender is not KYB verified
    function enforceIsLenderKYBVerified(string memory _lenderId) internal view {
        LenderState storage lenderState = diamondStorage();
        if(lenderState.lenders[_lenderId].status != KYBStatus.VERIFIED) {
            revert NotVerifiedLender(_lenderId);
        }
    }

    /// @dev Throws error if lender id not exist
    function enforceIsLenderIdExist(string calldata _lenderId) internal view {
        LenderState storage lenderState = diamondStorage();
        if(bytes(lenderState.lenders[_lenderId].lenderId).length == 0) {
            revert InvalidLenderId(_lenderId);
        }
    }

}

/// @title Lender Facet
contract LenderFacet {
    event DeleteLenderEvent(string indexed lenderId);
    event CreateLenderEvent(LenderLib.Lender lender);
    event UpdateLenderHashEvent(string indexed lenderId, string prevHash, string newHash);
    event UpdateLenderCountryEvent(string indexed lenderId, string prevCountry, string newCountry);
    event UpdateLenderOnBoardTimeEvent(string indexed lenderId, uint64 prevTime, uint64 newTime);
    event UpdateLenderWalletEvent(string indexed lenderId, address prevWallet, address newWallet);
    event UpdateLenderKYBEvent(string indexed lenderId, LenderLib.KYBStatus prevStatus, LenderLib.KYBStatus newStatus);
    
    /// @dev Returns on-chain attributes of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLender(string calldata _lenderId) external view returns (LenderLib.Lender memory) {
        return LenderLib.getLender(_lenderId);
    }

    /// @dev Returns userId of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderUserId(string calldata _lenderId) external view returns (string memory) {
        return LenderLib.getLenderUserId(_lenderId);
    }

    /// @dev Returns IPFS hash of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderMetaHash(string calldata _lenderId) external view returns (string memory) {
        return LenderLib.getLenderMetaHash(_lenderId);
    }

    /// @dev Returns country of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderCountry(string calldata _lenderId) external view returns (string memory) {
        return LenderLib.getLenderCountry(_lenderId);
    }

    /// @dev Returns onboarding time (Unix timestamp) of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderOnBoardTime(string calldata _lenderId) external view returns (uint64) {
        return LenderLib.getLenderOnBoardTime(_lenderId);
    }

    /// @dev Returns wallet address of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderWallet(string calldata _lenderId) external view returns (address) {
        return LenderLib.getLenderWallet(_lenderId);
    }

    /// @dev Returns KYB status of given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderKYBStatus(string calldata _lenderId) external view returns (LenderLib.KYBStatus) {
        return LenderLib.getLenderKYBStatus(_lenderId);
    }

    /// @dev Returns number of active pools for given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderPoolIdsLength(string calldata _lenderId) external view returns (uint256) {
        return LenderLib.getPoolIdsLength(_lenderId);
    }

    /// @dev Returns PoolId associated with given lender at given index
    /// @param _lenderId LenderId associated with given lender
    /// @param _index Index number to query
    function getLenderPoolId(string calldata _lenderId, uint256 _index) external view returns (string memory) {
        return LenderLib.getPoolId(_lenderId, _index);
    }

    /// @dev Returns all PoolIds associated with given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderPoolIds(string calldata _lenderId) external view returns (string[] memory) {
        return LenderLib.getPoolIds(_lenderId);
    }

    /// @dev Returns number of payments associated with given lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderPaymentIdsLength(string calldata _lenderId) external view returns (uint256) {
        return LenderLib.getPaymentIdsLength(_lenderId);
    }

    /// @dev Returns PaymentId that is associated with given lender at given index
    /// @param _lenderId LenderId associated with given lender
    /// @param _index Index number to query
    function getLenderPaymentId(string calldata _lenderId, uint256 _index) external view returns (string memory) {
        return LenderLib.getPaymentId(_lenderId, _index);
    }

    /// @dev Returns IPFS URL of given Lender
    /// @param _lenderId LenderId associated with given lender
    function getLenderMetadataURI(string calldata _lenderId) external view returns (string memory) {
        return LenderLib.getMetadataURI(_lenderId);
    }

    /// @dev Creates a new lender
    /// @notice Restricted access function, should be called by an address with create manager role
    /// @param _lenderId RoleId associated with lender
    /// @param _userId UserId associated with lender
    /// @param _metaHash IPFS has of lender
    /// @param _country Country code of lender
    /// @param _onBoardTime On-boarding time (Unix timestamp) of lender
    /// @param _wallet Wallet address of lender
    /// @param _status KYB status of lender 
    function createLender(
        string calldata _lenderId,
        string calldata _userId,
        string calldata _metaHash,
        string calldata _country,
        uint64 _onBoardTime,
        address _wallet,
        LenderLib.KYBStatus _status
    ) external {
        LenderLib.Lender memory lender = LenderLib.createLender(_lenderId, _userId, _metaHash, _country, _onBoardTime, _wallet, _status);
        emit CreateLenderEvent(lender);
    }

    /// @dev Deletes existing lender
    /// @notice Restricted access function, should be called by an address with delete manager role
    /// @param _lenderId LenderId to delete
    function deleteLender(string calldata _lenderId) external {
        LenderLib.removeLender(_lenderId);
        emit DeleteLenderEvent(_lenderId);
    }

    /// @dev Updates IPFS hash of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _hash New IPFS hash to set 
    function updateLenderHash(string calldata _lenderId, string calldata _hash) external {
        string memory _prevHash = LenderLib.getLenderMetaHash(_lenderId);
        LenderLib.updateLenderHash(_lenderId, _hash);
        emit UpdateLenderHashEvent(_lenderId, _prevHash, _hash);
    }

    /// @dev Updates country of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _country New country to set
    function updateLenderCountry(string calldata _lenderId, string calldata _country) external {
        string memory _prevCountry = LenderLib.getLenderCountry(_lenderId);
        LenderLib.updateLenderCountry(_lenderId, _country);
        emit UpdateLenderCountryEvent(_lenderId, _prevCountry, _country);
    }

    /// @dev Updates on-boarding time (Unix timestamp) of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _onBoardTime New on-board time (Unix timestamp) to set
    function updateLenderOnBoardTime(string calldata _lenderId, uint64 _onBoardTime) external {
        uint64 _prevTime = LenderLib.getLenderOnBoardTime(_lenderId);
        LenderLib.updateLenderOnBoardTime(_lenderId, _onBoardTime);
        emit UpdateLenderOnBoardTimeEvent(_lenderId, _prevTime, _onBoardTime);
    }

    /// @dev Updates wallet address of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _wallet New wallet address to set
    function updateLenderWallet(string calldata _lenderId, address _wallet) external {
        address _prevWallet = LenderLib.getLenderWallet(_lenderId);
        LenderLib.updateLenderWallet(_lenderId, _wallet);
        emit UpdateLenderWalletEvent(_lenderId, _prevWallet, _wallet);
    }

    /// @dev Updates KYB status of given lender
    /// @notice Restricted access function, should be called by an address with edit manager role
    /// @param _lenderId LenderId associated with given lender
    /// @param _status KYB status to set  
    function updateLenderKYB(string calldata _lenderId, LenderLib.KYBStatus _status) external {
        LenderLib.KYBStatus _prevStatus = LenderLib.getLenderKYBStatus(_lenderId);
        LenderLib.updateLenderKYB(_lenderId, _status);
        emit UpdateLenderKYBEvent(_lenderId, _prevStatus, _status);
    }

    /// @dev Removes PaymentId associated with given lender
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _lenderId LenderId associated with given lender
    /// @param _paymentId PaymentId to remove
    function removeLenderPaymentId(string calldata _lenderId, string calldata _paymentId) external {
        LenderLib.removePaymentId(_lenderId, _paymentId);
    }

    /// @dev Removes PaymentId associated with given lender based on given index
    /// @notice Restricted access function, should be called by an address with delete manager role 
    /// @param _lenderId LenderId associated with given lender
    /// @param _paymentIndex Index of PaymentId to remove
    function removeLenderPaymentIdByIndex(string calldata _lenderId, uint256 _paymentIndex) external {
        LenderLib.removePaymentIdByIndex(_lenderId, _paymentIndex);
    }
}