// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {AccessControlLib} from "./AccessControlFacet.sol";
import {VaultLib} from "./VaultFacet.sol";

error InvalidSigner(address signer, uint256 deniedForRole);
error NonceUsed(address signer, uint256 nonce);
error NotDistributeCall();

/// @title Distribute Library
library DistributeLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.distribute.storage");
    bytes32 constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 constant PAYMENT_INFO_TYPEHASH = keccak256(
        "PaymentInfo(uint256 amount,uint8 paymentType)"
    );
    bytes32 constant REQUEST_TYPEHASH = keccak256(
        "Request(uint256 nonce,string roleId,string poolId,PaymentInfo[] paymentInfo)PaymentInfo(uint256 amount,uint8 paymentType)"
    );

    struct DistributeState {
        mapping(address => mapping(uint256 => bool)) usedNonces;
        bytes32 domainSeperator;
        bool isDistributeCall;   
    }

    struct Request {
        uint256 nonce;
        string roleId;
        string poolId;
        VaultLib.PaymentInfo[] paymentInfo;
    }

    /// @dev Returns storage position of distribute library inside diamond
    function diamondStorage() internal pure returns (DistributeState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
    
    /// @dev Internal function to return encoded data of given payment information struct
    /// @param _paymentInfo Payment information 
    function encodePaymentInfo(VaultLib.PaymentInfo calldata _paymentInfo) internal pure returns (bytes memory) {
        return abi.encode(PAYMENT_INFO_TYPEHASH, _paymentInfo.amount, _paymentInfo.paymentType);
    }

    /// @dev Internal function to return hash of given request
    /// @param _request Request information
    function hashStruct(Request calldata _request) internal pure returns (bytes32) {
        bytes32[] memory encodedPaymentInfo = new bytes32[](_request.paymentInfo.length);
        for (uint256 i = 0; i < _request.paymentInfo.length; i++) {
            encodedPaymentInfo[i] = keccak256(encodePaymentInfo(_request.paymentInfo[i]));
        }
        return
            keccak256(
                abi.encode(
                    REQUEST_TYPEHASH,
                    _request.nonce,
                    keccak256(abi.encodePacked(_request.roleId)),
                    keccak256(abi.encodePacked(_request.poolId)),
                    keccak256(abi.encodePacked(encodedPaymentInfo))
                )
            );
    }

    /// @dev Returns the state of an authorization,
    //       more specifically if the specified nonce was already used by the address specified
    /// @param _signer Signer's address
    /// @param _nonce Nonce of the authorization
    /// @return true if nonce is used
    function authorizationState(address _signer, uint256 _nonce) internal view returns (bool) {
        DistributeState storage distributeState = diamondStorage();
        return distributeState.usedNonces[_signer][_nonce];
    }

    /// @dev Returns EIP-712 contract's domain separator
    /// @notice see https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator
    function getDomainSeperator() internal view returns (bytes32) {
        DistributeState storage distributeState = diamondStorage();
        return distributeState.domainSeperator;
    }

    /// @dev Returns chain id to construct domain seperator
    function getChainId() internal view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /// @dev Accept message hash and returns hash message in EIP712 compatible form,
    //       So that it can be used to recover signer from signature signed using EIP712 formatted data 
    function toTypedMessageHash(bytes32 _messageHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", getDomainSeperator(), _messageHash));
    }

    /// @dev Sets the EIP-712 contract domain separator
    /// @notice Restricted access function, should be called by an address with config manager role
    function setDomainSeperator() internal {
        AccessControlLib.enforceIsConfigManager();
        DistributeState storage distributeState = diamondStorage();
        distributeState.domainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("cSigmaDiamond")),
                keccak256(bytes("1")),
                getChainId(),
                address(this)
            )
        );
    }

    /// @dev Withdraws undistributed paid amount into the vault account of given lender
    /// @notice Throws error if signer do not have ROLE_DISTRIBUTE_MANAGER permission
    /// @param _request Request struct
    /// @param _sigR Half of the ECDSA signature pair
    /// @param _sigS Half of the ECDSA signature pair
    /// @param _sigV The recovery byte of the signature 
    function withdrawPoolPaymentIntoVault(
        Request calldata _request,
        bytes32 _sigR,
        bytes32 _sigS,
        uint8 _sigV
    ) internal {
        DistributeState storage distributeState = diamondStorage();
        address _signer = ecrecover(toTypedMessageHash(hashStruct(_request)), _sigV, _sigR, _sigS);
        if(!AccessControlLib.isOperatorInRole(_signer, AccessControlLib.ROLE_DISTRIBUTE_MANAGER)) {
            revert InvalidSigner(_signer, AccessControlLib.ROLE_DISTRIBUTE_MANAGER);
        }
        if(distributeState.usedNonces[_signer][_request.nonce]) {
            revert NonceUsed(_signer, _request.nonce);
        }
        distributeState.usedNonces[_signer][_request.nonce] = true;
        distributeState.isDistributeCall = true;
        VaultLib.distribute(_request.roleId, _request.poolId, _request.paymentInfo);
        distributeState.isDistributeCall = false; 
    }

    /// @dev Throws error if called by other than distribute library
    function enforceIsDistribute() internal view {
        DistributeState storage distributeState = diamondStorage();
        if(!distributeState.isDistributeCall) {
            revert NotDistributeCall();
        }
    }
}

/// @title Distribute facet
contract DistributeFacet {
    event Distribute(string indexed roleId, string poolId, VaultLib.PaymentInfo[] paymentInfo);
    event Withdraw(string indexed roleId, uint256 amount);
    event WithdrawStableCoin(string indexed roleId, address token, uint256 amount);
    event WithdrawRequest(string indexed roleId, address token, uint256 amount);
    
    /// @dev Returns the state of an authorization,
    //       more specifically if the specified nonce was already used by the address specified
    /// @param _signer Signer's address
    /// @param _nonce Nonce of the authorization
    /// @return true if nonce is used
    function authorizationState(address _signer, uint256 _nonce) external view returns (bool) {
        return DistributeLib.authorizationState(_signer, _nonce);
    }

    /// @dev Returns EIP-712 contract's domain separator
    /// @notice see https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator
    function getDomainSeperator() external view returns (bytes32) {
        return DistributeLib.getDomainSeperator();
    }

    /// @dev Sets the EIP-712 contract domain separator
    /// @notice Restricted access function, should be called by an address with config manager role
    function setDomainSeperator() external {
        return DistributeLib.setDomainSeperator();
    }

    /// @dev Withdraws undistributed paid amount into the vault account of given lender
    /// @notice Throws error if signer do not have ROLE_DISTRIBUTE_MANAGER permission
    /// @param _request Request struct
    /// @param _sigR Half of the ECDSA signature pair
    /// @param _sigS Half of the ECDSA signature pair
    /// @param _sigV The recovery byte of the signature 
    function withdrawPoolPaymentIntoVault(
        DistributeLib.Request calldata _request,
        bytes32 _sigR,
        bytes32 _sigS,
        uint8 _sigV
    ) external { 
        DistributeLib.withdrawPoolPaymentIntoVault(_request, _sigR, _sigS, _sigV);
        emit Distribute(_request.roleId, _request.poolId, _request.paymentInfo);
    }

    /// @dev Withdraws undistributed paid amount into the vault account of given lender,
    //       Submits withdraw request to withdraw given amount into the wallet
    /// @notice Throws error if signer do not have ROLE_DISTRIBUTE_MANAGER permission
    /// @param _request Request struct
    /// @param _sigR Half of the ECDSA signature pair
    /// @param _sigS Half of the ECDSA signature pair
    /// @param _sigV The recovery byte of the signature
    /// @param _token Address of token to withdraw from vault
    /// @param _amount Amount of token to withdraw from vault  
    function withdrawPoolPaymentIntoWallet(
        DistributeLib.Request calldata _request,
        bytes32 _sigR,
        bytes32 _sigS,
        uint8 _sigV,
        address _token,
        uint256 _amount
    ) external {
        DistributeLib.withdrawPoolPaymentIntoVault(_request, _sigR, _sigS, _sigV);
        emit Distribute(_request.roleId, _request.poolId, _request.paymentInfo);
        bool _isWithdrawn = VaultLib.withdrawRequest(_request.roleId, _token, _amount);
        if(_isWithdrawn) {
            if(_token == VaultLib.getPaymentToken()) {
                emit Withdraw(_request.roleId, _amount);
            } else {
                emit WithdrawStableCoin(_request.roleId, _token, _amount);
            }
        } else {
            emit WithdrawRequest(_request.roleId, _token, _amount);
        }
    }
}