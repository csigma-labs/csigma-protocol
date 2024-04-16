// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

error InvalidAmount(uint256 amount);
error InvalidLenderOrPoolId(string roleId, string poolId);
contract DistributeMock {
  
  enum PaymentType {
    INVESTMENT,
    PANDC,
    DEPOSIT,
    WITHDRAW,
    FEE,
    EXIT,
    PRINCIPAL,
    COUPON,
    PASTDUE
  }
  
  struct PaymentInfo {
        uint256 amount;
        PaymentType paymentType;
  }

  struct Request {
        uint256 nonce;
        string roleId;
        string poolId;
        PaymentInfo[] paymentInfo;
  }

  event Exit(string indexed roleId, string poolId, uint256 amount);
  event Fee(string indexed poolId, uint256 amount);
  event WithdrawRequest(string indexed roleId, address token, uint256 amount);
  event ReceiveRequest(string indexed roleId, string poolId, uint256 amount);

  function getChainId() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
  }

  function withdrawPoolPaymentIntoVault(
        Request calldata _request,
        bytes32 _sigR,
        bytes32 _sigS,
        uint8 _sigV
    ) external {}

  function withdrawPoolPaymentIntoWallet(
        Request calldata _request,
        bytes32 _sigR,
        bytes32 _sigS,
        uint8 _sigV,
        address _token,
        uint256 _amount
    ) external {}

  function pay(
        string calldata _roleId,
        string calldata _poolId,
        PaymentInfo[] calldata _paymentInfo
    ) external {}

  function withdrawRequest(string calldata _roleId, address _token, uint256 _amount) external returns(bool _isWithdrawn) {}
  function receiveInvestmentRequest(string calldata _roleId, string calldata _poolId, uint256 _amount) external returns(bool _isWithdrawn) {}
}
