// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
  constructor() 
    ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000E18);
    }
  
  function decimals() public override pure returns (uint8) {
    return 6;
  }

  function getChainId() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
  }
}
