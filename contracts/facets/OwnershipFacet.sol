// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

/// @dev Ownership Facet
contract OwnershipFacet is IERC173 {
    /// @dev Transfers ownership of diamond proxy
    /// @notice Restricted access function, should be called by owner only
    /// @param _newOwner Address of new owner
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    /// @dev Returns owner address of diamond proxy
    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
