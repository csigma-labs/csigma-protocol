/* global describe it before ethers */

import { BigNumber } from "ethers"

const { deployDiamond } = require('../../scripts/deploy.js')
  
const { assert, expect } = require('chai')

describe('VaultFacetTest', async function () {
  let diamondAddress
  let lenderFacet
  let creditPoolFacet
  let poolManagerFacet
  let paymentFacet
  let vaultFacet
  let distributeExtension
  let vaultFacetOwner
  let accessControlFacet
  let stableCoinExtension
  let paymentToken
  let contractOwner
  let lenderWallet
  let poolManagerWallet
  let addr1
  let addr2
  let addrs
  let domainData
  const metaHash = "0x"
  const borrowingAmount = 10000
  const inceptionTime = 1690792254
  const expiryTime = 1722414654
  const onBoardTime = 1690792254
  const country = "USA"
  const curingPeriod = 1
  const ROLE_INVEST_MANAGER = 0x0010_0000;
  const ROLE_WITHDRAW_MANAGER = 0x0020_0000;
  const ROLE_DISTRIBUTE_MANAGER = 0x0040_0000;
  const ROLE_FEE_MANAGER = 0x0080_0000;
  const [id1, id2, id3, id4, id5, id6, userId1, poolId1, poolId2, poolId3, poolId4, poolId5, poolId6, pmId1, pmId2, pmId3] = ["Alice", "Bob", "Charlie", "David", "Eric", "Fantom", "cSigmaUser01", "pool1", "pool2", "pool3", "pool4", "pool5", "pool6", "pm01", "pm02", "pm03"]
  enum KYBStatus {PENDING, VERIFIED, REJECTED}
  enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}
  enum RequestType {INVESTMENT, WITHDRAW, RECEIVE}
  enum PaymentType {INVESTMENT, PANDC, DEPOSIT, WITHDRAW, FEE, EXIT, PRINCIPAL, COUPON, PASTDUE}
  enum AccountType {LENDER, POOL}
  const domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];
  const types = {
    PaymentInfo:[
        { name: "amount", type: "uint256" },
        { name: "paymentType", type: "uint8" },
    ],
    Request: [
        { name: "nonce", type: "uint256" },
        { name: "roleId", type: "string" },
        { name: "poolId", type: "string" },
        { name: "paymentInfo", type: "PaymentInfo[]" },
    ]
  };

  before(async function () {
    diamondAddress = await deployDiamond();
    [contractOwner, lenderWallet, poolManagerWallet, addr1, addr2, ...addrs] = await ethers.getSigners();
    lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress);
    creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress);
    vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
    distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress);
    vaultFacetOwner = await ethers.getContractAt('VaultFacet', diamondAddress);
    paymentFacet = await ethers.getContractAt('PaymentFacet', diamondAddress);
    poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress);
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
    await accessControlFacet.initializeAccessControl();
    const ERC20Token = await ethers.getContractFactory('ERC20Mock');
    const erc20Token = await ERC20Token.deploy();
    await erc20Token.deployed();
    paymentToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
    await vaultFacet.initializePaymentToken(paymentToken.address);
    await vaultFacet.setMinDepositLimit(100);
    await stableCoinExtension.updateWhitelist(paymentToken.address);
    await poolManagerFacet.createPoolManager(pmId1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
    await poolManagerFacet.createPoolManager(pmId2, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
    await poolManagerFacet.createPoolManager(pmId3, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
    await stableCoinExtension.createCreditPool(poolId1, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId2, pmId2, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId3, pmId2, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId4, pmId2, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
    await distributeExtension.setDomainSeperator();
    const chainId = await paymentToken.getChainId();
    domainData = {
        name: "cSigmaDiamond",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: diamondAddress,
    };
  })

  describe("Deposit", async function () {
    before(async function () {
        await paymentToken.transfer(lenderWallet.address, 900);
        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
        await paymentToken.approve(diamondAddress, 900);
    })
    describe("when sender is not lender", async function () {
        before(async function() {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr1);
        })
        it("deposit fails", async function() {
            await expect(vaultFacet.deposit(id1, paymentToken.address, 100)).to.be.revertedWithCustomError(vaultFacet, "NotLender");
        })
    })    
    describe("when sender is lender", async function () {
        before(async function() {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            await lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING);
        })
        describe("when sender is not KYB verified", async function () {
            it("deposit fails", async function() {
                await expect(vaultFacet.deposit(id1, paymentToken.address, 100)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender");
            })
        })
        describe("when sender is KYB verified", async function () {
            before(async function() {
                await lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED);
            })
            it("fails if deposit amount is zero", async function() {
                await expect(vaultFacet.deposit(id1, paymentToken.address, 0)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");
            })
            it("fails if deposit amount is less than minimum deposit limit", async function() {
                await expect(vaultFacet.deposit(id1, paymentToken.address, 99)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");
            })
            it("fails if deposit amount is not transferred to vault", async function() {
                await expect(vaultFacet.deposit(id1, paymentToken.address, 1000)).to.be.reverted;
            })
            describe("succeed otherwise", async function () {
                it("should allow amount to be deposited into vault", async function() {
                    await vaultFacet.deposit(id1, paymentToken.address, 100);
                    expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(100);
                })
                it("should transfer tokens to vault", async function() {
                    expect(await paymentToken.balanceOf(diamondAddress)).to.be.equal(100);
                })
                it("should add payment to payment state", async function() {
                    const payment = await paymentFacet.getPayment("1");
                    assert.equal(payment.roleId, id1);
                    assert.equal(payment.creditPoolId, "");
                    assert.equal(payment.paymentType, PaymentType.DEPOSIT);
                    assert.equal(payment.from, lenderWallet.address);
                    assert.equal(payment.to, diamondAddress);
                    assert.equal(payment.amount, 100);
                })
                it("should add payment id to lender state", async function() {
                    expect(await lenderFacet.getLenderPaymentId(id1,0)).to.be.equal("1");
                })
                it("should emit deposit event", async function() {
                    await expect(vaultFacet.deposit(id1, paymentToken.address, 100))
                    .to.emit(vaultFacet, "Deposit")
                    .withArgs(id1, 100);
                })
            })
        })	    
    })   
  })

  describe("Invest", async function () {
    describe("invest", async function () {
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        })
        describe("when request is invalid", async function () {
            it("fails if sender is not lender", async function () {
                await expect(vaultFacet.invest(id2, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "NotLender");        
            })
            it("fails if lender is not KYB verified", async function () {
                await lenderFacet.updateLenderKYB(id1, KYBStatus.PENDING);
                await expect(vaultFacet.invest(id1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender");      
            })
            it("fails if pool is not active", async function () {
                await lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED);
                await expect(vaultFacet.invest(id1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "PoolIsNotActive");      
            })
            it("fails if pool is expired", async function () {
                await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
                await creditPoolFacet.updateCreditPoolExpiryTime(poolId1, 0);
                await expect(vaultFacet.invest(id1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "PoolIsExpired");      
            })
            it("fails if amount is zero", async function () {
                await creditPoolFacet.updateCreditPoolExpiryTime(poolId1, expiryTime);
                await expect(vaultFacet.invest(id1, poolId1, 0)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
            it("fails if previous request is pending", async function () {
                await vaultFacet.withdrawRequest(id1, paymentToken.address, 10);
                await expect(vaultFacet.invest(id1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "PendingRequestExist");      
                const length = await vaultFacet.getRequestsLength();
                await vaultFacetOwner.processWithdrawRequest(Number(length) - 1, false);
            })
            it("fails if amount is greater than vault balance", async function () {
                await expect(vaultFacet.invest(id1, poolId1, 10000)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
            it("fails if borrowed amount increased by an amount is greater than pool's borrowing limit", async function () {
                const borrowedAmount = await vaultFacet.getBorrowedAmount(poolId1);
                await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, borrowedAmount);
                await expect(vaultFacet.invest(id1, poolId1, 1)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
                await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, borrowingAmount);
            })
        })
        describe("succeed otherwise", async function () {
            before(async function () {
                await lenderFacet.createLender(id2, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
                await vaultFacet.deposit(id2, paymentToken.address, 100);
                await vaultFacet.invest(id1, poolId1, 10);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("4");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, poolId1);
                assert.equal(payment.paymentType, PaymentType.INVESTMENT);
                assert.equal(payment.from, lenderWallet.address);
                assert.equal(payment.to, diamondAddress);
                assert.equal(payment.amount, 10);
            })
            it("should add payment id to lender state", async function() {
                expect(await lenderFacet.getLenderPaymentId(id1, 2)).to.be.equal("4");
            })
            it("should add payment id to credit pool state", async function() {
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, 0)).to.be.equal("4");
            })
            it("should add lender id to credit pool state", async function() {
                expect(await creditPoolFacet.getCreditPoolLenderId(poolId1, 0)).to.be.equal(id1);
            })
            it("should update lender balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(190);
            })
            it("should update pool balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId1)).to.be.equal(10);
            })
            it("should update borrowed amount", async function() {
                expect(await vaultFacet.getBorrowedAmount(poolId1)).to.be.equal(10);
            })
            it("should emit invest event", async function() {
                await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId2, 10);
                await expect(vaultFacet.invest(id1, poolId2, 10))
                .to.emit(vaultFacet, "Invest")
                .withArgs(id1, poolId2, 10);
            })
        })
    }) 
  })

  describe("Exit", async function () {
    before(async function () {
        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        await vaultFacet.invest(id1, poolId3, 10);
        await vaultFacet.invest(id2, poolId1, 50);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address);
        await paymentToken.transfer(poolManagerWallet.address, 900);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
        await paymentToken.approve(diamondAddress, 900);
        const vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
        await vaultFacetPM.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.EXIT}]);
        await vaultFacetPM.pay(pmId2, poolId2, [{amount: 10, paymentType: PaymentType.EXIT}]);
    })
    describe("when signer doesn't have ROLE_DISTRIBUTE_MANAGER permission", async function () {
        let message, r, s, v;
        before(async function () {
            message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
            const signature = await lenderWallet._signTypedData(domainData, types, message);
            r = signature.substring(0, 66);
            s = "0x" + signature.substring(66, 130);
            v = parseInt(signature.substring(130, 132), 16);
        })
        it("fails", async function() {
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidSigner");
        })    
    })
    describe("when signer has ROLE_DISTRIBUTE_MANAGER permission", async function () {
        let message, r, s, v;
        before(async function () {
            await accessControlFacet.updateRole(addr2.address, ROLE_DISTRIBUTE_MANAGER);
            message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            r = signature.substring(0, 66);
            s = "0x" + signature.substring(66, 130);
            v = parseInt(signature.substring(130, 132), 16);
        })
        it("fails if sender is not lender", async function () {
            await lenderFacet.createLender(id3, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "NotLender");      
        })
        it("fails if lender is not KYB verified", async function () {
            distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
            message = {nonce: 1, roleId: id3, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            r = signature.substring(0, 66);
            s = "0x" + signature.substring(66, 130);
            v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "NotVerifiedLender");      
        })
        it("fails if lender is not investor in given credit pool", async function () {
            await lenderFacet.updateLenderKYB(id3, KYBStatus.VERIFIED);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidLenderOrPoolId");      
        })
        it("fails if amount is zero", async function () {
            message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 0, paymentType: PaymentType.EXIT}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            r = signature.substring(0, 66);
            s = "0x" + signature.substring(66, 130);
            v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidAmount");      
        })
        it("fails if amount is greater than paid balance of pool", async function () {
            message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10000, paymentType: PaymentType.EXIT}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            r = signature.substring(0, 66);
            s = "0x" + signature.substring(66, 130);
            v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidAmount");      
        })
        describe("succeed otherwise", async function () {
            let prevVaultBalOfLender, prevPaidBalOfPool;
            before(async function () {
                prevVaultBalOfLender = await vaultFacet.getVaultBalance(id1);
                prevPaidBalOfPool = await stableCoinExtension.getPaidBalance(poolId1);
                const message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("10");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, poolId1);
                assert.equal(payment.paymentType, PaymentType.EXIT);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 10);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("10");
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("10");
            })
            it("should remove lender id from credit pool state", async function() {
                expect(await creditPoolFacet.getCreditPoolLenderId(poolId1, 0)).to.be.equal(id2);
            })
            it("should update lender balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(Number(prevVaultBalOfLender) + 10);
            })
            it("should update paid balance of pool", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(Number(prevPaidBalOfPool) - 10);
            })
            it("should emit exit event", async function() {
                const message = {nonce: 2, roleId: id1, poolId: poolId2, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, lenderWallet);
                await expect(distributeMock.withdrawPoolPaymentIntoVault(message, r, s, v))
                .to.emit(distributeMock, "Exit")
                .withArgs(id1, poolId2, 10);
            })    
        })
    })
  })

  describe("Withdraw", async function () {
    describe("Withdraw request", async function () {
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId2, borrowingAmount);
            await vaultFacet.invest(id2, poolId2, 10);
            await vaultFacet.deposit(id3, paymentToken.address, 100);
        })
        describe("when request is invalid", async function () {
            it("fails if sender is not lender", async function () {
                await expect(vaultFacet.withdrawRequest(id4, paymentToken.address, 100)).to.be.revertedWithCustomError(vaultFacet, "NotLender");        
            })
            it("fails if lender is not KYB verified", async function () {
                await lenderFacet.updateLenderKYB(id3, KYBStatus.PENDING);
                await expect(vaultFacet.withdrawRequest(id3, paymentToken.address, 100)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender");      
            })
            it("fails if amount is zero", async function () {
                await lenderFacet.updateLenderKYB(id3, KYBStatus.VERIFIED);
                await expect(vaultFacet.withdrawRequest(id3, paymentToken.address, 0)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
            it("fails if amount is greater than vault balance", async function () {
                await expect(vaultFacet.withdrawRequest(id3, paymentToken.address, 101)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
        })
        describe("when request is valid", async function () {
            before(async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacet.withdrawRequest(id3, paymentToken.address, 100);
            })
            it("fails if previous request is pending", async function () {
                await expect(vaultFacet.withdrawRequest(id3, paymentToken.address, 100)).to.be.revertedWithCustomError(vaultFacet, "PendingRequestExist");      
            })
            it("succeed if previous request is not pending", async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacet.processWithdrawRequest(0, false);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacet.withdrawRequest(id3, paymentToken.address, 100);
                expect(await vaultFacet.getRequestsLength()).to.be.equal(1);   
            })
            it("should return request status", async function () {
                const requestStatus = await vaultFacet.getRequestStatus(id3);
                assert.equal(requestStatus.isPending, true);
                assert.equal(requestStatus.requestIndex, 0);
            })
            it("should return request data", async function () {
                const request = await vaultFacet.getRequestByIndex(0);
                assert.equal(request.roleId, id3);
                assert.equal(request.poolId, "");
                assert.equal(request.wallet, lenderWallet.address);
                assert.equal(request.requestType, RequestType.WITHDRAW);
                assert.equal(request.amount, 100);
            })
        })
    })
    describe("process withdraw request", async function () {
        describe("when sender doesn't have ROLE_WITHDRAW_MANAGER permission", async function () {
            it("fails", async function() {
                await expect(vaultFacet.processWithdrawRequest(0, true)).to.be.revertedWithCustomError(vaultFacet, "AccessDenied");
            })    
        })
        describe("when sender has ROLE_WITHDRAW_MANAGER permission", async function () {
            beforeEach(async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_WITHDRAW_MANAGER);
            })
            describe("when given request index is not correct", async function () {
                await expect(vaultFacet.processWithdrawRequest(1, true)).to.be.revertedWithCustomError(vaultFacet, "InvalidRequestIndex");
            })
            describe("when given request index is correct", async function () {
                describe("when request is processed with approval", async function () {
                    let prevBal;
                    it("fails if lender is not KYB verified", async function () {
                        await lenderFacet.updateLenderKYB(id3, KYBStatus.PENDING);
                        await expect(vaultFacet.processWithdrawRequest(0, true)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender");      
                    })
                    it("succeed otherwise", async function () {
                        await lenderFacet.updateLenderKYB(id3, KYBStatus.VERIFIED);
                        prevBal = await paymentToken.balanceOf(lenderWallet.address);
                        await vaultFacet.processWithdrawRequest(0, true);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(0);      
                    })
                    it("should add payment to payment state", async function() {
                        const payment = await paymentFacet.getPayment("14");
                        assert.equal(payment.roleId, id3);
                        assert.equal(payment.creditPoolId, "");
                        assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                        assert.equal(payment.from, diamondAddress);
                        assert.equal(payment.to, lenderWallet.address);
                        assert.equal(payment.amount, 100);
                    })
                    it("should add payment id to lender state", async function() {
                        expect(await lenderFacet.getLenderPaymentId(id3, 1)).to.be.equal("14");
                    })
                    it("should update lender balance", async function() {
                        expect(await vaultFacet.getVaultBalance(id3)).to.be.equal(0);
                    })
                    it("should transfer tokens to lender", async function() {
                        expect(await paymentToken.balanceOf(lenderWallet.address)).to.be.equal(Number(prevBal) + 100);
                    })
                    it("should allow to create new request", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                        await vaultFacet.deposit(id3, paymentToken.address, 100);
                        await vaultFacet.withdrawRequest(id3, paymentToken.address, 100);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(1);
                    })
                    it("should emit withdraw event", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
                        await expect(vaultFacet.processWithdrawRequest(0, true))
                        .to.emit(vaultFacet, "Withdraw")
                        .withArgs(id3, 100);
                    })
                })
                describe("when request is processed anyway", async function () {
                    before(async function () {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                        await vaultFacet.deposit(id3, paymentToken.address, 100);
                        await vaultFacet.withdrawRequest(id3, paymentToken.address, 50);
                        await lenderFacet.createLender(id4, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
                        await vaultFacet.deposit(id4, paymentToken.address, 100);
                        await vaultFacet.withdrawRequest(id4, paymentToken.address, 10);
                    })
                    it("should remove request index", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
                        await vaultFacet.processWithdrawRequest(0, true);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(1);
                    })
                    it("should update request status", async function () {
                        const requestStatus = await vaultFacet.getRequestStatus(id3);
                        assert.equal(requestStatus.isPending, false);
                        assert.equal(requestStatus.requestIndex, 0);
                    })
                    it("should replace removed request index with last index", async function () {
                        const request = await vaultFacet.getRequestByIndex(0);
                        assert.equal(request.roleId, id4);
                        assert.equal(request.poolId, "");
                        assert.equal(request.wallet, lenderWallet.address);
                        assert.equal(request.requestType, RequestType.WITHDRAW);
                        assert.equal(request.amount, 10);
                    })
                    it("should update request index of last requester", async function () {
                        const requestStatus = await vaultFacet.getRequestStatus(id4);
                        assert.equal(requestStatus.isPending, true);
                        assert.equal(requestStatus.requestIndex, 0);
                    })
                    it("should allow to create new request", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                        await vaultFacet.withdrawRequest(id3, paymentToken.address, 50);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(2);
                    })
                })
            })
        })
    })
  })

  describe("Receive Investment", async function () {
    describe("receive investment request", async function () {
        describe("when request is invalid", async function () {
            it("fails if given pool manager and credit pool are not bound to each other", async function () {
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, "", 10)).to.be.revertedWithCustomError(vaultFacet, "InvalidRoleOrPoolId");        
            })
            it("fails if sender is not pool manager", async function () {
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "NotPoolManager");        
            })
            it("fails if pool manager is not KYB verified", async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.PENDING);
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedPoolManager");      
            })
            it("fails if credit pool is not active", async function () {
                await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.VERIFIED);
                await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.PENDING);
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "PoolIsNotActive");      
            })
            it("fails if amount is zero", async function () {
                await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 0)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
            it("fails if amount is greater than vault balance", async function () {
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 1000)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
            })
        })
        describe("when request is valid", async function () {
            before(async function () {
                await vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10);
            })
            it("fails if previous request is pending", async function () {
                await expect(vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacet, "PendingRequestExist");      
            })
            it("succeed if previous request is not pending", async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacet.processReceiveInvestmentRequest(2, false);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10);
                expect(await vaultFacet.getRequestsLength()).to.be.equal(3);   
            })
            it("should return request status", async function () {
                const requestStatus = await vaultFacet.getRequestStatus(pmId1);
                assert.equal(requestStatus.isPending, true);
                assert.equal(requestStatus.requestIndex, 2);
            })
            it("should return request data", async function () {
                const request = await vaultFacet.getRequestByIndex(2);
                assert.equal(request.roleId, pmId1);
                assert.equal(request.poolId, poolId1);
                assert.equal(request.wallet, poolManagerWallet.address);
                assert.equal(request.requestType, RequestType.RECEIVE);
                assert.equal(request.amount, 10);
            })
        })
    })
    describe("process receive investment request", async function () {
        describe("when sender doesn't have ROLE_WITHDRAW_MANAGER permission", async function () {
            it("fails", async function() {
                await expect(vaultFacet.processReceiveInvestmentRequest(2, true)).to.be.revertedWithCustomError(vaultFacet, "AccessDenied");
            })    
        })
        describe("when sender has ROLE_WITHDRAW_MANAGER permission", async function () {
            beforeEach(async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_WITHDRAW_MANAGER);
            })
            describe("when given request index is not correct", async function () {
                await expect(vaultFacet.processReceiveInvestmentRequest(3, true)).to.be.revertedWithCustomError(vaultFacet, "InvalidRequestIndex");
            })
            describe("when given request index is correct", async function () {
                describe("when request is processed with approval", async function () {
                    let prevBal, prevVaultBal;
                    it("fails if pool manager is not KYB verified", async function () {
                        await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.PENDING);
                        await expect(vaultFacet.processReceiveInvestmentRequest(2, true)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedPoolManager");      
                    })
                    it("fails if credit pool is not active", async function () {
                        await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.VERIFIED);
                        await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.PENDING);
                        await expect(vaultFacet.processReceiveInvestmentRequest(2, true)).to.be.revertedWithCustomError(vaultFacet, "PoolIsNotActive");      
                    })
                    it("succeed otherwise", async function () {
                        await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
                        prevBal = await paymentToken.balanceOf(poolManagerWallet.address);
                        prevVaultBal = await vaultFacet.getVaultBalance(poolId1);
                        await vaultFacet.processReceiveInvestmentRequest(2, true);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(2);      
                    })
                    it("should add payment to payment state", async function() {
                        const payment = await paymentFacet.getPayment("20");
                        assert.equal(payment.roleId, pmId1);
                        assert.equal(payment.creditPoolId, poolId1);
                        assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                        assert.equal(payment.from, diamondAddress);
                        assert.equal(payment.to, poolManagerWallet.address);
                        assert.equal(payment.amount, 10);
                    })
                    it("should add payment id to pool manager state", async function() {
                        const length = await poolManagerFacet.getPoolManagerPaymentIdsLength(pmId1);
                        expect(await poolManagerFacet.getPoolManagerPaymentId(pmId1, Number(length) - 1)).to.be.equal("20");
                    })
                    it("should add payment id to credit pool state", async function() {
                        const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                        expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("20");
                    })
                    it("should update credit pool balance", async function() {
                        expect(await vaultFacet.getVaultBalance(poolId1)).to.be.equal(Number(prevVaultBal) - 10);
                    })
                    it("should transfer tokens to pool manager", async function() {
                        expect(await paymentToken.balanceOf(poolManagerWallet.address)).to.be.equal(Number(prevBal) + 10);
                    })
                    it("should allow to create new request", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                        await vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(3);
                    })
                    it("should emit receive event", async function() {
                        await expect(vaultFacet.processReceiveInvestmentRequest(2, true))
                        .to.emit(vaultFacet, "Receive")
                        .withArgs(pmId1, poolId1, 10);
                    })
                })
                describe("when request is processed anyway", async function () {
                    before(async function () {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                        await vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10);
                        await lenderFacet.createLender(id5, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                        await vaultFacet.deposit(id5, paymentToken.address, 100);
                        await vaultFacet.withdrawRequest(id5, paymentToken.address, 10);
                    })
                    it("should remove request index", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
                        await vaultFacet.processReceiveInvestmentRequest(2, true);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(3);
                    })
                    it("should update request status", async function () {
                        const requestStatus = await vaultFacet.getRequestStatus(pmId1);
                        assert.equal(requestStatus.isPending, false);
                        assert.equal(requestStatus.requestIndex, 0);
                    })
                    it("should replace removed request index with last index", async function () {
                        const request = await vaultFacet.getRequestByIndex(2);
                        assert.equal(request.roleId, id5);
                        assert.equal(request.poolId, "");
                        assert.equal(request.wallet, lenderWallet.address);
                        assert.equal(request.requestType, RequestType.WITHDRAW);
                        assert.equal(request.amount, 10);
                    })
                    it("should update request index of last requester", async function () {
                        const requestStatus = await vaultFacet.getRequestStatus(id5);
                        assert.equal(requestStatus.isPending, true);
                        assert.equal(requestStatus.requestIndex, 2);
                    })
                    it("should allow to create new request", async function() {
                        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                        await vaultFacet.receiveInvestmentRequest(pmId1, poolId1, 10);
                        expect(await vaultFacet.getRequestsLength()).to.be.equal(4);
                    })
                })
            })
        })
    })
  })

  describe("Pay coupon / principal", async function () {
    describe("when given pool manager and credit pool are not bound to each other", async function () {
        before(async function() {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr1);
        })
        it("pay fails", async function() {
            await expect(vaultFacet.pay(id1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacet, "InvalidRoleOrPoolId");
        })
    })
    describe("when given pool manager and credit pool are bound to each other", async function () {
        describe("when sender is not pool manager", async function () {
            it("pay fails", async function() {
                await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacet, "NotPoolManager");
            })
        })    
        describe("when sender is pool manager", async function () {
            before(async function() {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.PENDING);
                await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.PENDING);
                paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
                await paymentToken.approve(diamondAddress, 100);
            })
            describe("when sender is not KYB verified", async function () {
                it("pay fails", async function() {
                    await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedPoolManager");
                })
            })
            describe("when sender is KYB verified", async function () {
                before(async function() {
                    await poolManagerFacet.updatePoolManagerKYB(pmId1, KYBStatus.VERIFIED);
                })
                it("fails if pool is not active", async function() {
                    await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacet, "PoolIsNotActive");
                })
                it("fails if pay amount is zero", async function() {
                    await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
                    await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 0, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");
                })
                it("fails if payment type is invalid", async function() {
                    await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.DEPOSIT}])).to.be.revertedWithCustomError(vaultFacet, "InvalidPaymentType");
                })
                it("fails if pay amount is not transferred to vault", async function() {
                    await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 1000, paymentType: PaymentType.COUPON}])).to.be.reverted;
                })
                describe("succeed otherwise", async function () {
                    let prevPaidBal, prevBal;
                    before(async function() {
                        prevPaidBal = await stableCoinExtension.getPaidBalance(poolId1);
                        prevBal = await paymentToken.balanceOf(diamondAddress);
                        await vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}]);
                    })
                    it("should transfer tokens to vault", async function() {
                        expect(await paymentToken.balanceOf(diamondAddress)).to.be.equal(Number(prevBal) + 10);
                    })
                    it("should add payment to payment state", async function() {
                        const payment = await paymentFacet.getPayment("24");
                        assert.equal(payment.roleId, pmId1);
                        assert.equal(payment.creditPoolId, poolId1);
                        assert.equal(payment.paymentType, PaymentType.COUPON);
                        assert.equal(payment.from, poolManagerWallet.address);
                        assert.equal(payment.to, diamondAddress);
                        assert.equal(payment.amount, 10);
                    })
                    it("should add payment id to pool manager state", async function() {
                        const length = await poolManagerFacet.getPoolManagerPaymentIdsLength(pmId1);
                        expect(await poolManagerFacet.getPoolManagerPaymentId(pmId1, Number(length) - 1)).to.be.equal("24");
                    })
                    it("should add payment id to credit pool state", async function() {
                        const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                        expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("24");
                    })
                    it("should update paid balance of pool", async function() {
                        expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(Number(prevPaidBal) + 10);
                    })
                    it("should emit pay event", async function() {
                        await expect(vaultFacet.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}]))
                        .to.emit(vaultFacet, "Pay")
                        .withArgs(pmId1, poolId1, []);
                        // https://github.com/NomicFoundation/hardhat/issues/3833
                    })
                })
            })	    
        })        
    })   
  })

  describe("Check balance", async function () {
    let vaultFacetPoolManager, vaultFacetLender;
    before(async function () {
        await lenderFacet.createLender(id6, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, contractOwner);
        vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
        vaultFacetPoolManager = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
    })
    describe("initially", async function () {
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(0);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })          
    })
    describe("deposit", async function () {
        before(async function () {
            await vaultFacetLender.deposit(id6, paymentToken.address, 100);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(100);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })          
    })
    describe("invest", async function () {
        before(async function () {
            await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId2, 1000);
            await vaultFacetLender.invest(id6, poolId2, 30);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(70);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(50);
        })          
    })
    describe("receive investment", async function () {
        before(async function () {
            await vaultFacetPoolManager.receiveInvestmentRequest(pmId2, poolId2, 30);
            const length = await vaultFacet.getRequestsLength();
            await vaultFacet.processReceiveInvestmentRequest(Number(length) - 1, true);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(70);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })          
    })
    describe("pay coupon / principal", async function () {
        before(async function () {
            await vaultFacetPoolManager.pay(pmId2, poolId2, [{amount: 20, paymentType: PaymentType.COUPON}]);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(70);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })
        it("pool paid balance", async function() {
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(20);
        })          
    })
    describe("distribute", async function () {
        before(async function () {
            const message = {nonce: 1, roleId: id6, poolId: poolId2, paymentInfo: [{amount: 5, paymentType: PaymentType.COUPON}],};
            const signature = await contractOwner._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(75);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })
        it("pool paid balance", async function() {
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(15);
        })          
    })
    describe("exit", async function () {
        before(async function () {
            const message = {nonce: 2, roleId: id6, poolId: poolId2, paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],};
            const signature = await contractOwner._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(85);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })
        it("pool paid balance", async function() {
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(5);
        })          
    })
    describe("withdraw", async function () {
        before(async function () {
            await vaultFacetLender.withdrawRequest(id6, paymentToken.address, 85);
            const length = await vaultFacet.getRequestsLength();
            await vaultFacet.processWithdrawRequest(Number(length) - 1, true);
        })
        it("lender balance", async function() {
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(0);
        })
        it("pool balance", async function() {
            expect(await vaultFacet.getVaultBalance(poolId2)).to.be.equal(20);
        })
        it("pool paid balance", async function() {
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(5);
        })          
    })
  })

  describe("Collect protocol fee", async function () {
    describe("when pool manager pays fee", async function () {
        let vaultFacetPM;
        beforeEach(async function () {
            vaultFacetPM = await ethers.getContractAt('DistributeMock', diamondAddress, poolManagerWallet);
        })
        it("fails if amount is zero", async function () {
            await expect(vaultFacetPM.pay(pmId1, poolId1, [{amount: 0, paymentType: PaymentType.FEE}])).to.be.reverted;      
        })
        it("fails if pool manager do not have enough tokens to pay for", async function () {
            await expect(vaultFacetPM.pay(pmId1, poolId1, [{amount: 1000, paymentType: PaymentType.FEE}])).to.be.reverted;      
        })
        describe("succeed otherwise", async function () {
            let prevBal, prevBalOfOwner, prevVaultBalOfPool, prevPaidBal;
            before(async function () {
                prevBal = await paymentToken.balanceOf(diamondAddress);
                prevBalOfOwner = await paymentToken.balanceOf(contractOwner.address);
                await vaultFacetPM.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.FEE}]);
                prevVaultBalOfPool = await vaultFacet.getVaultBalance(poolId1);
                prevPaidBal = await stableCoinExtension.getPaidBalance(poolId1);   
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("33");
                assert.equal(payment.roleId, pmId1);
                assert.equal(payment.creditPoolId, poolId1);
                assert.equal(payment.paymentType, PaymentType.FEE);
                assert.equal(payment.from, poolManagerWallet.address);
                assert.equal(payment.to, contractOwner.address);
                assert.equal(payment.amount, 10);
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("33");
            })
            it("should not update pool balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId1)).to.be.equal(BigNumber.from(prevVaultBalOfPool));
            })
            it("should not update pool paid balance", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(BigNumber.from(prevPaidBal));
            })
            it("should transfer tokens to protocol owner", async function() {
                expect(await paymentToken.balanceOf(diamondAddress)).to.be.equal(Number(prevBal) - 10);
                expect(await paymentToken.balanceOf(contractOwner.address)).to.be.equal(BigNumber.from(prevBalOfOwner).add(10));
            })
            it("should emit fee event", async function() {
                await expect(vaultFacetPM.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.FEE}]))
                .to.emit(vaultFacetPM, "Fee")
                .withArgs(poolId1, 10);
            })
        })
    })
  })

  describe("Adjust vault balance", async function () {
    describe("when sender is not contract owner", async function () {
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr1);
        })
        it("fails", async function() {
            await expect(vaultFacet.adjustVaultBalance(id1, 10, AccountType.LENDER, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(vaultFacet, "NotContractOwner");
        })    
    })
    describe("when sender is contract owner", async function () {
        beforeEach(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, contractOwner);
        })
        it("fails if amount is zero", async function () {
            await expect(vaultFacet.adjustVaultBalance(id1, 0, AccountType.LENDER, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
        })
        describe("increase vault balance of lender", async function () {
            let prevVaultBalOfLender;
            before(async function () {
                prevVaultBalOfLender = await vaultFacet.getVaultBalance(id1);
                await vaultFacet.adjustVaultBalance(id1, 100, AccountType.LENDER, PaymentType.DEPOSIT); 
            })
            it("should add payment to payment state", async function() {
                let payment = await paymentFacet.getPayment("35");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, "");
                assert.equal(payment.paymentType, PaymentType.DEPOSIT);
                assert.equal(payment.from, contractOwner.address);
                assert.equal(payment.to, diamondAddress);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("35");
            })
            it("should increase lender balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(Number(prevVaultBalOfLender) + 100);
            })
            it("should emit adjust event", async function() {
                await expect(vaultFacet.adjustVaultBalance(id1, 100, AccountType.LENDER, PaymentType.DEPOSIT))
                .to.emit(vaultFacet, "Adjust")
                .withArgs(id1, 100, AccountType.LENDER, PaymentType.DEPOSIT);
            })
        })
        describe("increase paid balance of pool", async function () {
            let prevVaultBalOfPool;
            before(async function () {
                prevVaultBalOfPool = await stableCoinExtension.getPaidBalance(poolId1);
                await vaultFacet.adjustVaultBalance(poolId1, 100, AccountType.POOL, PaymentType.DEPOSIT); 
            })
            it("should add payment to payment state", async function() {
                let payment = await paymentFacet.getPayment("37");
                assert.equal(payment.roleId, "");
                assert.equal(payment.creditPoolId, poolId1);
                assert.equal(payment.paymentType, PaymentType.DEPOSIT);
                assert.equal(payment.from, contractOwner.address);
                assert.equal(payment.to, diamondAddress);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("37");
            })
            it("should increase paid balance", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(Number(prevVaultBalOfPool) + 100);
            })
            it("should emit adjust event", async function() {
                await expect(vaultFacet.adjustVaultBalance(poolId1, 100, AccountType.POOL, PaymentType.DEPOSIT))
                .to.emit(vaultFacet, "Adjust")
                .withArgs(poolId1, 100, AccountType.POOL, PaymentType.DEPOSIT);
            })
        })
        describe("decrease vault balance of lender", async function () {
            it("fails if amount is greater than vault balance of lender", async function() {
                await expect(vaultFacet.adjustVaultBalance(id1, 1000, AccountType.LENDER, PaymentType.WITHDRAW)).to.be.reverted;
            })
            describe("succeed otherwise", async function () {
                let prevVaultBalOfLender;
                before(async function () {
                    prevVaultBalOfLender = await vaultFacet.getVaultBalance(id1); 
                    await vaultFacet.adjustVaultBalance(id1, 100, AccountType.LENDER, PaymentType.WITHDRAW);
                })
                it("should add payment to payment state", async function() {
                    let payment = await paymentFacet.getPayment("39");
                    assert.equal(payment.roleId, id1);
                    assert.equal(payment.creditPoolId, "");
                    assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                    assert.equal(payment.from, diamondAddress);
                    assert.equal(payment.to, contractOwner.address);
                    assert.equal(payment.amount, 100);
                })
                it("should add payment id to lender state", async function() {
                    const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                    expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("39");
                })
                it("should decrease lender balance", async function() {
                    expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(Number(prevVaultBalOfLender) - 100);
                })
                it("should emit adjust event", async function() {
                    await expect(vaultFacet.adjustVaultBalance(id1, 100, AccountType.LENDER, PaymentType.WITHDRAW))
                    .to.emit(vaultFacet, "Adjust")
                    .withArgs(id1, 100, AccountType.LENDER, PaymentType.WITHDRAW);
                })
            })
        })
        describe("decrease paid balance of pool", async function () {
            it("fails if amount is greater than vault balance of lender", async function() {
                await expect(vaultFacet.adjustVaultBalance(poolId1, 1000, AccountType.POOL, PaymentType.WITHDRAW)).to.be.reverted;
            })
            describe("succeed otherwise", async function () {
                let prevVaultBalOfPool;
                before(async function () {
                    prevVaultBalOfPool = await stableCoinExtension.getPaidBalance(poolId1);
                    await vaultFacet.adjustVaultBalance(poolId1, 100, AccountType.POOL, PaymentType.WITHDRAW); 
                })
                it("should add payment to payment state", async function() {
                    let payment = await paymentFacet.getPayment("41");
                    assert.equal(payment.roleId, "");
                    assert.equal(payment.creditPoolId, poolId1);
                    assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                    assert.equal(payment.from, diamondAddress);
                    assert.equal(payment.to, contractOwner.address);
                    assert.equal(payment.amount, 100);
                })
                it("should add payment id to pool state", async function() {
                    const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                    expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("41");
                })
                it("should decrease paid balance", async function() {
                    expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(Number(prevVaultBalOfPool) - 100);
                })
                it("should emit adjust event", async function() {
                    await expect(vaultFacet.adjustVaultBalance(poolId1, 100, AccountType.POOL, PaymentType.WITHDRAW))
                    .to.emit(vaultFacet, "Adjust")
                    .withArgs(poolId1, 100, AccountType.POOL, PaymentType.WITHDRAW);
                })
            })
        })
    })
  })

  describe("Pause / Unpause protocol", async function () {
    describe("when sender is not contract owner", async function () {
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr1);
        })
        it("fails", async function() {
            await expect(vaultFacet.pause()).to.be.revertedWithCustomError(vaultFacet, "NotContractOwner");
        })    
    })
    describe("when sender is contract owner", async function () {
        let vaultFacetPoolManager, vaultFacetLender;
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, contractOwner);
            vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            vaultFacetPoolManager = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
        })
        it("fails to unpause if already not paused", async function () {
            await expect(vaultFacet.unpause()).to.be.revertedWithCustomError(vaultFacet, "ExpectedPause");      
        })
        it("fails to pause if already paused", async function () {
            await vaultFacet.pause();
            await expect(vaultFacet.pause()).to.be.revertedWithCustomError(vaultFacet, "EnforcedPause");      
        })
        it("succeed otherwise", async function () {
            await vaultFacet.unpause();
            expect(await vaultFacet.paused()).to.be.equal(false);
            await vaultFacet.pause();
            expect(await vaultFacet.paused()).to.be.equal(true);      
        })
        it("should emit unpaused event when unpaused", async function() {
            await expect(vaultFacet.unpause()).to.emit(vaultFacet, "Unpaused").withArgs(contractOwner.address);
        })
        it("should emit paused event when paused", async function() {
            await expect(vaultFacet.pause()).to.emit(vaultFacet, "Paused").withArgs(contractOwner.address);
        })
        describe("when contract is paused", async function () {
            it("should not allow to deposit", async function () {
                await expect(vaultFacetLender.deposit(id1, paymentToken.address, 10)).to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should not allow to invest", async function () {
                await expect(vaultFacetLender.invest(id1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should not allow to register withdraw request", async function () {
                await expect(vaultFacetLender.withdrawRequest(id1, paymentToken.address, 10)).to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should not allow to register receive investment request", async function () {
                await expect(vaultFacetPoolManager.receiveInvestmentRequest(pmId1, poolId1, 10)).to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })
            it("should not allow to pay", async function () {
                await expect(vaultFacetPoolManager.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })
            it("should not allow to withdraw pool payment", async function () {
                const message = {nonce: 4, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })  
        })
        describe("when contract is not paused", async function () {
            before(async function () {
                await vaultFacet.unpause();
            })
            it("should allow to deposit", async function () {
                await expect(vaultFacetLender.deposit(id1, paymentToken.address, 10)).not.to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should allow to invest", async function () {
                await expect(vaultFacetLender.invest(id1, poolId1, 10)).not.to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should allow to register withdraw request", async function () {
                await expect(vaultFacetLender.withdrawRequest(id1, paymentToken.address, 10)).not.to.be.revertedWithCustomError(vaultFacetLender, "EnforcedPause");
            })
            it("should allow to register receive investment request", async function () {
                await expect(vaultFacetPoolManager.receiveInvestmentRequest(pmId1, poolId1, 10)).not.to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })
            it("should allow to pay", async function () {
                await expect(vaultFacetPoolManager.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}])).not.to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })
            it("should allow to withdraw pool payment", async function () {
                const message = {nonce: 3, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await expect(await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).not.to.be.revertedWithCustomError(vaultFacetPoolManager, "EnforcedPause");
            })  
        })
    })
  })

  describe("Distribute", async function () {
    before(async function () {
        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr1);
    })
    describe("when signer doesn't have ROLE_DISTRIBUTE_MANAGER permission", async function () {
        it("fails", async function() {
            const message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
            const signature = await addr1._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidSigner");
        })    
    })
    describe("when signer has ROLE_DISTRIBUTE_MANAGER permission", async function () {
        let vaultFacetPM;
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, addr2);
            vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
            const vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
            await accessControlFacet.updateRole(addr2.address, ROLE_DISTRIBUTE_MANAGER);
            await paymentToken.approve(diamondAddress, 100);
            await vaultFacetLender.deposit(id6, paymentToken.address, 100);
            await vaultFacetLender.invest(id6, poolId1, 10);
            await vaultFacetPM.pay(pmId1, poolId1, [{amount: 10, paymentType: PaymentType.COUPON}]);
        })
        it("fails if amount is zero", async function () {
            const message = {nonce: 4, roleId: id6, poolId: poolId1, paymentInfo: [{amount: 0, paymentType: PaymentType.COUPON}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
        })
        it("fails if payment type is invalid", async function() {
            const message = {nonce: 4, roleId: id6, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.DEPOSIT}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidPaymentType");
        })
        it("fails if amount is greater than vault balance", async function () {
            const message = {nonce: 4, roleId: id6, poolId: poolId1, paymentInfo: [{amount: 1000, paymentType: PaymentType.COUPON}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(vaultFacet, "InvalidAmount");      
        })
        it("fails if sender is not lender", async function () {
            const message = {nonce: 4, roleId: id3, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(vaultFacet, "NotLender");      
        })
        it("fails if lender is not KYB verified", async function () {
            distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
            const message = {nonce: 4, roleId: id3, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await lenderFacet.updateLenderKYB(id3, KYBStatus.PENDING);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender");      
        })
        it("fails if lender is not investor in given credit pool", async function () {
            const message = {nonce: 4, roleId: id3, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
            const signature = await addr2._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await lenderFacet.updateLenderKYB(id3, KYBStatus.VERIFIED);
            await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidLenderOrPoolId");
        })
        describe("succeed otherwise", async function () {
            let prevVaultBalOfLender, prevPaidBalOfPool;
            before(async function () {
                prevVaultBalOfLender = await vaultFacet.getVaultBalance(id6);
                prevPaidBalOfPool = await stableCoinExtension.getPaidBalance(poolId1);
                const message = {nonce: 4, roleId: id6, poolId: poolId1, paymentInfo: [{amount: 1, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("49");
                assert.equal(payment.roleId, id6);
                assert.equal(payment.creditPoolId, poolId1);
                assert.equal(payment.paymentType, PaymentType.COUPON);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 1);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id6);
                expect(await lenderFacet.getLenderPaymentId(id6, Number(length) - 1)).to.be.equal("49");
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId1, Number(length) - 1)).to.be.equal("49");
            })
            it("should not remove lender id from credit pool state", async function() {
                const binding = await creditPoolFacet.getLenderBinding(id6, poolId1);
                assert.equal(binding.isBound, true);
            })
            it("should update lender balance", async function() {
                expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(Number(prevVaultBalOfLender) + 1);
            })
            it("should update paid balance", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId1)).to.be.equal(Number(prevPaidBalOfPool) - 1);
            })
            it("should emit distribute event", async function() {
                const message = {nonce: 5, roleId: id6, poolId: poolId1, paymentInfo: [{amount: 1, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await expect(await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v))
                .to.emit(distributeExtension, "Distribute")
                .withArgs(id6, poolId1, []);
                // https://github.com/NomicFoundation/hardhat/issues/3833
            })    
        })
    })
  })

  describe("Payment breakdown", async function () {
    before(async function () {
        const vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        await vaultFacetLender.invest(id6, poolId2, 25);
    })
    describe("Pay", async function () {
        let prevBalOfPool, prevPaidBalOfPool, prevBalOfContract, lastPaymentId; 
        before(async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
            await vaultFacet.receiveInvestmentRequest(pmId2, poolId2, 25);
            const length = await vaultFacet.getRequestsLength();
            await vaultFacetOwner.processReceiveInvestmentRequest(Number(length) - 1, true);
            prevPaidBalOfPool = await stableCoinExtension.getPaidBalance(poolId2);
            prevBalOfPool = await vaultFacet.getVaultBalance(poolId2);
            prevBalOfContract = await paymentToken.balanceOf(diamondAddress);
            lastPaymentId = await paymentFacet.getLastPaymentId();
        })
        it("should allow to pay with payment breakdown", async function() {
            const principal = {amount: 5, paymentType: PaymentType.PRINCIPAL};
            const coupon = {amount: 3, paymentType: PaymentType.COUPON};
            const pastDue = {amount: 2, paymentType: PaymentType.PASTDUE}
            await vaultFacet.pay(pmId2, poolId2, [principal, coupon, pastDue]);
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(Number(prevPaidBalOfPool) + 10);
            expect(await paymentToken.balanceOf(diamondAddress)).to.be.equal(BigNumber.from(prevBalOfContract).add(BigNumber.from(10)));      
        })
        it("should add payment with braekdown to payment state", async function() {
            const payment1 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(1)).toString());
            const payment2 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(2)).toString());
            const payment3 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(3)).toString());
            assert.equal(payment1.roleId, pmId2);
            assert.equal(payment1.creditPoolId, poolId2);
            assert.equal(payment1.paymentType, PaymentType.PRINCIPAL);
            assert.equal(payment1.from, poolManagerWallet.address);
            assert.equal(payment1.to, diamondAddress);
            assert.equal(payment1.amount, 5);
            assert.equal(payment2.roleId, pmId2);
            assert.equal(payment2.creditPoolId, poolId2);
            assert.equal(payment2.paymentType, PaymentType.COUPON);
            assert.equal(payment2.from, poolManagerWallet.address);
            assert.equal(payment2.to, diamondAddress);
            assert.equal(payment2.amount, 3);
            assert.equal(payment3.roleId, pmId2);
            assert.equal(payment3.creditPoolId, poolId2);
            assert.equal(payment3.paymentType, PaymentType.PASTDUE);
            assert.equal(payment3.from, poolManagerWallet.address);
            assert.equal(payment3.to, diamondAddress);
            assert.equal(payment3.amount, 2);
        })
    })
    describe("Distribute", async function () {
        let prevBalOfPool, prevBalOfLender, lastPaymentId;
        before(async function () {
            prevBalOfPool = await stableCoinExtension.getPaidBalance(poolId2);
            prevBalOfLender = await vaultFacet.getVaultBalance(id6);
            lastPaymentId = await paymentFacet.getLastPaymentId();
        })
        it("should allow to distribute with payment breakdown", async function() {
            const principal = {amount: 5, paymentType: PaymentType.PRINCIPAL};
            const coupon = {amount: 3, paymentType: PaymentType.COUPON};
            const pastDue = {amount: 2, paymentType: PaymentType.PASTDUE};
            const message = {nonce: 5, roleId: id6, poolId: poolId2, paymentInfo: [principal, coupon, pastDue],};
            const signature = await contractOwner._signTypedData(domainData, types, message);
            const r = signature.substring(0, 66);
            const s = "0x" + signature.substring(66, 130);
            const v = parseInt(signature.substring(130, 132), 16);
            await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)
            expect(await stableCoinExtension.getPaidBalance(poolId2)).to.be.equal(Number(prevBalOfPool) - 10);
            expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(Number(prevBalOfLender) + 10);  
        })
        it("should add payment with braekdown to payment state", async function() {
            const payment1 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(1)).toString());
            const payment2 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(2)).toString());
            const payment3 = await paymentFacet.getPayment(lastPaymentId.add(BigNumber.from(3)).toString());
            assert.equal(payment1.roleId, id6);
            assert.equal(payment1.creditPoolId, poolId2);
            assert.equal(payment1.paymentType, PaymentType.PRINCIPAL);
            assert.equal(payment1.from, diamondAddress);
            assert.equal(payment1.to, lenderWallet.address);
            assert.equal(payment1.amount, 5);
            assert.equal(payment2.roleId, id6);
            assert.equal(payment2.creditPoolId, poolId2);
            assert.equal(payment2.paymentType, PaymentType.COUPON);
            assert.equal(payment2.from, diamondAddress);
            assert.equal(payment2.to, lenderWallet.address);
            assert.equal(payment2.amount, 3);
            assert.equal(payment3.roleId, id6);
            assert.equal(payment3.creditPoolId, poolId2);
            assert.equal(payment3.paymentType, PaymentType.PASTDUE);
            assert.equal(payment3.from, diamondAddress);
            assert.equal(payment3.to, lenderWallet.address);
            assert.equal(payment3.amount, 2);
        })
    })    
  })

  describe("Emergency withdraw", async function () {
    let anyToken;
    before(async function() {
        const ERC20Token = await ethers.getContractFactory('ERC20Mock');
        const erc20Token = await ERC20Token.deploy();
        await erc20Token.deployed();
        anyToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
        await anyToken.transfer(diamondAddress, 100);
    })
    describe("when sender is not contract owner", async function () {
        before(async function () {
            stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr1);
        })
        it("fails", async function() {
            await expect(stableCoinExtension.emergencyWithdraw(anyToken.address, addr1.address, 100)).to.be.revertedWithCustomError(stableCoinExtension, "NotContractOwner");
        })    
    })
    describe("when sender is contract owner", async function () {
        let prevBal;
        before(async function () {
            stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, contractOwner);
            prevBal = await anyToken.balanceOf(addr1.address);
        })
        it("fails if amount is zero", async function() {
            await expect(stableCoinExtension.emergencyWithdraw(anyToken.address, addr1.address, 0)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidAmount");
        })
        it("fails if contract doesn't have enough balance", async function() {
            await expect(stableCoinExtension.emergencyWithdraw(anyToken.address, addr1.address, 1000)).to.be.reverted;
        })
        it("succeed otherwise", async function() {
            await stableCoinExtension.emergencyWithdraw(anyToken.address, addr1.address, 50);
            expect(await anyToken.balanceOf(addr1.address)).to.be.equal(Number(prevBal) + 50);
        })
        it("should emit emergency withdraw event", async function() {
            await expect(stableCoinExtension.emergencyWithdraw(anyToken.address, addr1.address, 50))
            .to.emit(stableCoinExtension, "EmergencyWithdraw")
            .withArgs(contractOwner.address, anyToken.address, addr1.address, 50);
        })    
    })
  })

  describe("Lender auto withdraw", async function () {
    let vaultFacetLender, stableCoin;
    before(async function () {
        vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address);
        await paymentToken.transfer(lenderWallet.address, 10000);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
        await paymentToken.approve(diamondAddress, 10000);
        await vaultFacetLender.deposit(id6, paymentToken.address, 100);
        const ERC20Token = await ethers.getContractFactory('ERC20Mock');
        const erc20Token = await ERC20Token.deploy();
        await erc20Token.deployed();
        stableCoin = await ethers.getContractAt('ERC20Mock', erc20Token.address);
        await stableCoin.transfer(lenderWallet.address, 10000);
        stableCoin = await ethers.getContractAt('ERC20Mock', erc20Token.address, lenderWallet);
        await stableCoin.approve(diamondAddress, 10000); 
        await stableCoinExtension.updateWhitelist(stableCoin.address);
        await vaultFacetLender.deposit(id6, stableCoin.address, 100);
    })
    describe("When withdraw amount is greater than lender threshold", async function () {
        let length;
        before(async function () {
            await stableCoinExtension.updateLenderThreshold(50);
            length = await vaultFacet.getRequestsLength();
            await vaultFacetLender.withdrawRequest(id6, stableCoin.address, 100);
        })
        it("should add withdraw request", async function () {
            expect(await vaultFacet.getRequestsLength()).to.be.equal(Number(length) + 1);
        })
        it("should emit withdraw request event", async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
            await vaultFacet.processWithdrawRequest(length, true);
            const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, lenderWallet);
            await expect(distributeMock.withdrawRequest(id6, paymentToken.address, 100))
                .to.emit(distributeMock, "WithdrawRequest")
                .withArgs(id6, paymentToken.address, 100);
        })
    })
    describe("When withdraw amount is not greater than lender threshold", async function () {
        let length;
        before(async function () {
            await stableCoinExtension.updateLenderThreshold(100);
            length = await vaultFacet.getRequestsLength();
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
            await vaultFacet.processWithdrawRequest(Number(length) - 1, true);
        })
        describe("When cooling period of given lender is over", async function () {
            let length, prevBalPaymentToken, prevBalStableCoin, prevTokenBal, prevStableBal, prevTime;
            before(async function () {
                await vaultFacetLender.deposit(id6, paymentToken.address, 100);
                await vaultFacetLender.deposit(id6, stableCoin.address, 100);
                length = await vaultFacet.getRequestsLength();
                prevBalPaymentToken = await vaultFacet.getVaultBalance(id6);
                prevBalStableCoin = await stableCoinExtension.getStableCoinBalance(id6, stableCoin.address);
                prevTokenBal = await paymentToken.balanceOf(lenderWallet.address);
                prevStableBal = await stableCoin.balanceOf(lenderWallet.address);
            })
            it("should emit withdraw stable coin event", async function() {
                await expect(vaultFacetLender.withdrawRequest(id6, stableCoin.address, 100))
                .to.emit(vaultFacetLender, "WithdrawStableCoin")
                .withArgs(id6, stableCoin.address, 100);
                prevTime = await stableCoinExtension.getLastWithdrawalTimeStamp(id6);
            })
            it("should emit withdraw event", async function() {
                await expect(vaultFacetLender.withdrawRequest(id6, paymentToken.address, 100))
                .to.emit(vaultFacetLender, "Withdraw")
                .withArgs(id6, 100);
            })
            it("should not add withdraw request", async function () {
                expect(await vaultFacet.getRequestsLength()).to.be.equal(length);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("66");
                assert.equal(payment.roleId, id6);
                assert.equal(payment.creditPoolId, "");
                assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id6);
                expect(await lenderFacet.getLenderPaymentId(id6, Number(length) - 1)).to.be.equal("66");
            })
            it("should update lender balance", async function() {
                expect(await vaultFacet.getVaultBalance(id6)).to.be.equal(Number(prevBalPaymentToken) - 100);
                expect(await stableCoinExtension.getStableCoinBalance(id6, stableCoin.address)).to.be.equal(Number(prevBalStableCoin) - 100);
            })
            it("should update withdraw timestamp", async function() {
                const timeDiff = await stableCoinExtension.getLastWithdrawalTimeStamp(id6) - prevTime;
                expect(timeDiff).not.to.be.equal(0);
            })
            it("should transfer tokens to lender", async function() {
                expect(await paymentToken.balanceOf(lenderWallet.address)).to.be.equal(Number(prevTokenBal) + 100);
                expect(await stableCoin.balanceOf(lenderWallet.address)).to.be.equal(Number(prevStableBal) + 100);
            })
        })
        describe("When cooling period of given lender is not over", async function () {
            let length;
            before(async function () {
                await stableCoinExtension.updateLenderCoolingTime(1000000);
                length = await vaultFacet.getRequestsLength();
                await vaultFacetLender.deposit(id6, paymentToken.address, 100);
                await vaultFacetLender.deposit(id6, stableCoin.address, 100);
                await vaultFacetLender.withdrawRequest(id6, stableCoin.address, 100);
            })
            it("should add withdraw request", async function () {
                expect(await vaultFacet.getRequestsLength()).to.be.equal(Number(length) + 1);
            })
            it("should emit withdraw request event", async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacet.processWithdrawRequest(length, true);
                const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, lenderWallet);
                await expect(distributeMock.withdrawRequest(id6, paymentToken.address, 100))
                    .to.emit(distributeMock, "WithdrawRequest")
                    .withArgs(id6, paymentToken.address, 100);
                await vaultFacet.processWithdrawRequest(length, false);
            })
        })
    })
  })

  describe("Pool manager auto receive investment", async function () {
    let vaultFacetLender, vaultFacetPM, stableCoin;
    before(async function () {
        vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
        vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        await vaultFacetLender.deposit(id6, paymentToken.address, 1000);
        const ERC20Token = await ethers.getContractFactory('ERC20Mock');
        const erc20Token = await ERC20Token.deploy();
        await erc20Token.deployed();
        stableCoin = await ethers.getContractAt('ERC20Mock', erc20Token.address);
        await stableCoin.transfer(lenderWallet.address, 10000);
        stableCoin = await ethers.getContractAt('ERC20Mock', erc20Token.address, lenderWallet);
        await stableCoin.approve(diamondAddress, 10000); 
        await stableCoinExtension.updateWhitelist(stableCoin.address);
        await vaultFacetLender.deposit(id6, stableCoin.address, 1000);
        stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
        await stableCoinExtension.createCreditPool(poolId5, pmId3, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
        await stableCoinExtension.createCreditPool(poolId6, pmId3, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, stableCoin.address);
        await vaultFacetLender.invest(id6, poolId5, 1000);
        await vaultFacetLender.invest(id6, poolId6, 1000);
    })
    describe("When receive investment amount is greater than pool threshold", async function () {
        let length;
        before(async function () {
            await stableCoinExtension.updatePoolThreshold(50);
            length = await vaultFacet.getRequestsLength();
            await vaultFacetPM.receiveInvestmentRequest(pmId3, poolId5, 100);
        })
        it("should add receive investment request", async function () {
            expect(await vaultFacet.getRequestsLength()).to.be.equal(Number(length) + 1);
        })
        it("should emit receive request event", async function () {
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
            await vaultFacet.processReceiveInvestmentRequest(length, true);
            const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, poolManagerWallet);
            await expect(distributeMock.receiveInvestmentRequest(pmId3, poolId6, 100))
                .to.emit(distributeMock, "ReceiveRequest")
                .withArgs(pmId3, poolId6, 100);
        })
    })
    describe("When receive investment amount is not greater than pool threshold", async function () {
        let length;
        before(async function () {
            await stableCoinExtension.updatePoolThreshold(100);
            length = await vaultFacet.getRequestsLength();
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
            await vaultFacet.processReceiveInvestmentRequest(Number(length) - 1, true);
        })
        describe("When cooling period of given pool is over", async function () {
            let length, prevBalPool5, prevBalPool6, prevTokenBal, prevStableBal, prevTimePool5, prevTimePool6;
            before(async function () {
                length = await vaultFacet.getRequestsLength();
                prevBalPool5 = await vaultFacet.getVaultBalance(poolId5);
                prevBalPool6 = await vaultFacet.getVaultBalance(poolId6);
                prevTokenBal = await paymentToken.balanceOf(poolManagerWallet.address);
                prevStableBal = await stableCoin.balanceOf(poolManagerWallet.address);
                prevTimePool5 = await stableCoinExtension.getLastWithdrawalTimeStamp(poolId5);
                await vaultFacetPM.receiveInvestmentRequest(pmId3, poolId5, 100);
            })
            it("should emit receive event", async function() {
                prevTimePool6 = await stableCoinExtension.getLastWithdrawalTimeStamp(poolId6);
                await expect(vaultFacetPM.receiveInvestmentRequest(pmId3, poolId6, 100))
                .to.emit(vaultFacetPM, "Receive")
                .withArgs(pmId3, poolId6, 100);
            })
            it("should not add receive investment request", async function () {
                expect(await vaultFacet.getRequestsLength()).to.be.equal(length);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("77");
                assert.equal(payment.roleId, pmId3);
                assert.equal(payment.creditPoolId, poolId6);
                assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, poolManagerWallet.address);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId6);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId6, Number(length) - 1)).to.be.equal("77");
            })
            it("should update credit pool balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId5)).to.be.equal(Number(prevBalPool5) - 100);
                expect(await vaultFacet.getVaultBalance(poolId6)).to.be.equal(Number(prevBalPool6) - 100);
            })
            it("should update receive investment timestamp", async function() {
                let timeDiff = await stableCoinExtension.getLastWithdrawalTimeStamp(poolId5) - prevTimePool5;
                expect(timeDiff).not.to.be.equal(0);
                timeDiff = await stableCoinExtension.getLastWithdrawalTimeStamp(poolId6) - prevTimePool6;
                expect(timeDiff).not.to.be.equal(0);
            })
            it("should transfer tokens to pool manager", async function() {
                expect(await paymentToken.balanceOf(poolManagerWallet.address)).to.be.equal(Number(prevTokenBal) + 100);
                expect(await stableCoin.balanceOf(poolManagerWallet.address)).to.be.equal(Number(prevStableBal) + 100);
            })
        })
        describe("When cooling period of given pool is not over", async function () {
            let length;
            before(async function () {
                await stableCoinExtension.updatePoolCoolingTime(1000000);
                length = await vaultFacet.getRequestsLength();
                await vaultFacetPM.receiveInvestmentRequest(pmId3, poolId5, 100);
            })
            it("should add receive investment request", async function () {
                expect(await vaultFacet.getRequestsLength()).to.be.equal(Number(length) + 1);
            })
            it("should emit receive request event", async function () {
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacet.processReceiveInvestmentRequest(length, true);
                const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, poolManagerWallet);
                await expect(distributeMock.receiveInvestmentRequest(pmId3, poolId6, 100))
                    .to.emit(distributeMock, "ReceiveRequest")
                    .withArgs(pmId3, poolId6, 100);
            })
        })
    })
  })
})