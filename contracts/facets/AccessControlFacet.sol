// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {LibDiamond} from "../libraries/LibDiamond.sol";

error AccessControlIsInitialized();
error AccessDenied(address executor, uint256 deniedForRole);

/// @title Access Control Library
library AccessControlLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.accesscontrol.storage");
    uint256 constant FULL_PRIVILEGES_MASK = type(uint256).max;
    uint256 constant ROLE_ACCESS_MANAGER = 0x8000000000000000000000000000000000000000000000000000000000000000;
    uint32 constant ROLE_CREATE_MANAGER = 0x0001_0000;
    uint32 constant ROLE_DELETE_MANAGER = 0x0002_0000;
    uint32 constant ROLE_EDIT_MANAGER = 0x0004_0000;
    uint32 constant ROLE_CONFIG_MANAGER = 0x0008_0000;
    uint32 constant ROLE_INVEST_MANAGER = 0x0010_0000;
    uint32 constant ROLE_WITHDRAW_MANAGER = 0x0020_0000;
    uint32 constant ROLE_DISTRIBUTE_MANAGER = 0x0040_0000;
    uint32 constant ROLE_FEE_MANAGER = 0x0080_0000;

    struct AccessControlState {
        mapping(address => uint256) userRoles;
        bool isInitialized;
    }

    event RoleUpdated(address indexed by, address indexed to, uint256 requested, uint256 actual);

    /// @dev Returns storage position of access control library inside diamond
    function diamondStorage() internal pure returns (AccessControlState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Checks if role `actual` contains all the permissions required `required`
    /// @param _actual Existent role
    /// @param _required Required role
    /// @return true If actual has required role (all permissions), false otherwise
	function hasRole(uint256 _actual, uint256 _required) internal pure returns(bool) {
		return _actual & _required == _required;
	}
    
    /// @dev Effectively reads userRoles role for the contract itself
    /// @notice Retrieves globally set of features enabled
    /// @return 256-bit bitmask of the features enabled
    function features() internal view returns(uint256) {
		AccessControlState storage accessControlState = diamondStorage();
        return accessControlState.userRoles[address(this)];
	}

    /// @dev Checks if requested set of features is enabled globally on the contract
    /// @param _required Set of features to check against
    /// @return true If all the features requested are enabled, false otherwise
    function isFeatureEnabled(uint256 _required) internal view returns(bool) {
		return hasRole(features(), _required);
	}

    /// @dev Checks if operator has all the permissions (role) required
    /// @param _operator Address of the user to check role for
    /// @param _required Set of permissions (role) to check
    /// @return true If all the permissions requested are enabled, false otherwise
    function isOperatorInRole(address _operator, uint256 _required) internal view returns(bool) {
		AccessControlState storage accessControlState = diamondStorage();
        return hasRole(accessControlState.userRoles[_operator], _required);
	}

    /// @dev Checks if transaction sender `msg.sender` has all the permissions required
    /// @param _required Set of permissions (role) to check against
    /// @return true If all the permissions requested are enabled, false otherwise
	function isSenderInRole(uint256 _required) internal view returns(bool) {
		return isOperatorInRole(msg.sender, _required);
	}

    /// @notice Determines the permission bitmask an operator can set on the target permission set
    /// @notice Used to calculate the permission bitmask to be set when requested
    //          in `updateRole` and `updateFeatures` functions
    //
    /// @dev Calculated based on:
    //       1) operator's own permission set read from userRoles[operator]
    //       2) target permission set - what is already set on the target
    //       3) desired permission set - what do we want set target to
    //
    /// @dev Corner cases:
    //       1) Operator is super admin and its permission set is `FULL_PRIVILEGES_MASK`:
    //        `desired` bitset is returned regardless of the `target` permission set value
    //        (what operator sets is what they get)
    //       2) Operator with no permissions (zero bitset):
    //        `target` bitset is returned regardless of the `desired` value
    //        (operator has no authority and cannot modify anything)
    //
    /// @dev Example:
    //       Consider an operator with the permissions bitmask     00001111
    //       is about to modify the target permission set          01010101
    //       Operator wants to set that permission set to          00110011
    //       Based on their role, an operator has the permissions
    //       to update only lowest 4 bits on the target, meaning that
    //       high 4 bits of the target set in this example is left
    //       unchanged and low 4 bits get changed as desired:      01010011
    //
    /// @param _operator Address of the contract operator which is about to set the permissions
    /// @param _target Input set of permissions to operator is going to modify
    /// @param _desired Desired set of permissions operator would like to set
    /// @return Set of permissions given operator will set
    function evaluateBy(address _operator, uint256 _target, uint256 _desired) internal view returns(uint256) {
		AccessControlState storage accessControlState = diamondStorage();
		uint256 p = accessControlState.userRoles[_operator];
        _target |= p & _desired;
		_target &= FULL_PRIVILEGES_MASK ^ (p & (FULL_PRIVILEGES_MASK ^ _desired));
		return _target;
	}

    /// @dev Initializes access control by assigning full privileges to contract owner
    /// @notice Restricted access function, should be called by owner only
    function initializeAccessControl() internal {
        LibDiamond.enforceIsContractOwner();
        AccessControlState storage accessControlState = diamondStorage();
        if(accessControlState.isInitialized) {
            revert AccessControlIsInitialized();
        }
        accessControlState.userRoles[LibDiamond.contractOwner()] = FULL_PRIVILEGES_MASK;
        accessControlState.isInitialized = true;
    }

    /// @dev Updates set of permissions (role) for a given user, 
    //       taking into account sender's permissions
    /// @notice Requires transaction sender to have `ROLE_ACCESS_MANAGER` permission
    /// @param _operator Address of a user to alter permissions for or zero
    //         to alter global features of the smart contract
    /// @param _role Bitmask representing a set of permissions to enable/disable for a user specified
	function updateRole(address _operator, uint256 _role) internal {
		AccessControlState storage accessControlState = diamondStorage();
        if(!isSenderInRole(ROLE_ACCESS_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_ACCESS_MANAGER);
        }
		accessControlState.userRoles[_operator] = evaluateBy(msg.sender, accessControlState.userRoles[_operator], _role);
        emit RoleUpdated(msg.sender, _operator, _role, accessControlState.userRoles[_operator]);
    }

    /// @dev Updates set of the globally enabled features (`features`)
    /// @notice Requires transaction sender to have `ROLE_ACCESS_MANAGER` permission
    /// @param _mask Bitmask representing a set of features to enable/disable
    function updateFeatures(uint256 _mask) internal {
		updateRole(address(this), _mask);
	}

    /// @dev Throws error if sender do not have create manager role
    function enforceIsCreateManager() internal view {
        if(!isSenderInRole(ROLE_CREATE_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_CREATE_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have delete manager role
    function enforceIsDeleteManager() internal view {
        if(!isSenderInRole(ROLE_DELETE_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_DELETE_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have edit manager role
    function enforceIsEditManager() internal view {
        if(!isSenderInRole(ROLE_EDIT_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_EDIT_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have config manager role
    function enforceIsConfigManager() internal view {
        if(!isSenderInRole(ROLE_CONFIG_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_CONFIG_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have invest manager role
    function enforceIsInvestManager() internal view {
        if(!isSenderInRole(ROLE_INVEST_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_INVEST_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have withdraw manager role
    function enforceIsWithdrawManager() internal view {
        if(!isSenderInRole(ROLE_WITHDRAW_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_WITHDRAW_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have distribute manager role
    function enforceIsDistributeManager() internal view {
        if(!isSenderInRole(ROLE_DISTRIBUTE_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_DISTRIBUTE_MANAGER);
        }        
    }

    /// @dev Throws error if sender do not have fee manager role
    function enforceIsFeeManager() internal view {
        if(!isSenderInRole(ROLE_FEE_MANAGER)) {
            revert AccessDenied(msg.sender, ROLE_FEE_MANAGER);
        }        
    }
}

/// @title Access Control Facet
contract AccessControlFacet {
    /// @dev Effectively reads userRoles role for the contract itself
    /// @notice Retrieves globally set of features enabled
    /// @return 256-bit bitmask of the features enabled
    function features() external view returns(uint256) {
		return AccessControlLib.features();
	}

    /// @dev Checks if requested set of features is enabled globally on the contract
    /// @param _required Set of features to check against
    /// @return true If all the features requested are enabled, false otherwise
    function isFeatureEnabled(uint256 _required) external view returns(bool) {
		return AccessControlLib.isFeatureEnabled(_required);
	}

    /// @dev Checks if operator has all the permissions (role) required
    /// @param _operator Address of the user to check role for
    /// @param _required Set of permissions (role) to check
    /// @return true If all the permissions requested are enabled, false otherwise
    function isOperatorInRole(address _operator, uint256 _required) external view returns(bool) {
		return AccessControlLib.isOperatorInRole(_operator, _required);
	}

    /// @dev Checks if transaction sender `msg.sender` has all the permissions required
    /// @param _required Set of permissions (role) to check against
    /// @return true If all the permissions requested are enabled, false otherwise
	function isSenderInRole(uint256 _required) external view returns(bool) {
		return AccessControlLib.isSenderInRole(_required);
	}

    /// @dev Initializes access control by assigning full privileges to contract owner
    /// @notice Restricted access function, should be called by owner only
    function initializeAccessControl() external {
        AccessControlLib.initializeAccessControl();
    }
    
    /// @dev Updates set of permissions (role) for a given user, 
    //       taking into account sender's permissions
    /// @notice Requires transaction sender to have `ROLE_ACCESS_MANAGER` permission
    /// @param _operator Address of a user to alter permissions for or zero
    //         to alter global features of the smart contract
    /// @param _role Bitmask representing a set of permissions to enable/disable for a user specified
	function updateRole(address _operator, uint256 _role) external {
		AccessControlLib.updateRole(_operator, _role);
	}

    /// @dev Updates set of the globally enabled features (`features`)
    /// @notice Requires transaction sender to have `ROLE_ACCESS_MANAGER` permission
    /// @param _mask Bitmask representing a set of features to enable/disable
    function updateFeatures(uint256 _mask) external {
		return AccessControlLib.updateRole(address(this), _mask);
	}
}