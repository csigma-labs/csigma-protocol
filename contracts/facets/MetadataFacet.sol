// SPDX-License-Identifier: BUSL-1.1
// @author cSigma Finance Inc., a Delaware company, for its Real World Credit tokenization protocol
pragma solidity ^0.8.0;

import {AccessControlLib} from "./AccessControlFacet.sol";

/// @title Metadata Library
library MetadataLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("csigma.metadata.storage");

    struct MetadataState {
        string baseURI;
    }

    /// @dev Returns storage position of metadata library inside diamond
    function diamondStorage() internal pure returns (MetadataState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @dev Returns base URI which is used to construct IPFS URL of given hash
    function getBaseURI() internal view returns (string memory) {
        MetadataState storage metadataState = diamondStorage();
        return metadataState.baseURI;
    }

    /// @dev Updates base URI which is used to construct IPFS URL of given hash
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _baseURI New base URI to set
    function updateBaseURI(string calldata _baseURI) internal {
        AccessControlLib.enforceIsConfigManager();
        MetadataState storage metadataState = diamondStorage();
        metadataState.baseURI = _baseURI;
    }    
}

/// @title Metadata Facet
contract MetadataFacet {
    event UpdateBaseURI(string prevBaseURI, string newBaseURI);

    /// @dev Returns base URI which is used to construct IPFS URL of given hash
    function getBaseURI() external view returns (string memory) {
        return MetadataLib.getBaseURI();
    }

    /// @dev Updates base URI which is used to construct IPFS URL of given hash
    /// @notice Restricted access function, should be called by an address with config manager role
    /// @param _baseURI New base URI to set
    function updateBaseURI(string calldata _baseURI) external {
        string memory _prevBaseURI = MetadataLib.getBaseURI();
        MetadataLib.updateBaseURI(_baseURI);
        emit UpdateBaseURI(_prevBaseURI, _baseURI);
    }
}