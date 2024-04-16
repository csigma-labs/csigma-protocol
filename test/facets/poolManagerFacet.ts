/* global describe it before ethers */

import { string } from "hardhat/internal/core/params/argumentTypes"

const { deployDiamond } = require('../../scripts/deploy.js')
  
const { assert, expect } = require('chai')

describe('PoolManagerFacetTest', async function () {
  let diamondAddress
  let poolManagerFacet
  let creditPoolFacet
  let vaultFacet
  let metadataFacet
  let accessControlFacet
  let vaultFacetLender
  let lenderFacet
  let stableCoinExtension
  let paymentToken
  let contractOwner
  let poolManagerWallet
  let lenderWallet
  let addr1
  let addr2
  let addrs
  const metaHash = "0x"
  const borrowingAmount = 10000
  const inceptionTime = 1690792254
  const expiryTime = 1722414654
  const onBoardTime = 1690792254
  const country = "USA"
  const baseURI = "https://csigma.finance/"
  const curingPeriod = 1
  const ROLE_CREATE_MANAGER = 0x0001_0000;
  const ROLE_DELETE_MANAGER = 0x0002_0000;
  const ROLE_EDIT_MANAGER = 0x0004_0000;
  const [id1, id2, id3, id4, userId1, lenderId1] = ["Alice", "Bob", "Charlie", "David", "userId1", "lender01"]
  enum KYBStatus {PENDING, VERIFIED, REJECTED}
  enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}
  enum PaymentType {INVESTMENT, PANDC, DEPOSIT, WITHDRAW, FEE, EXIT, PRINCIPAL, COUPON, PASTDUE}

  before(async function () {
    diamondAddress = await deployDiamond();
    [contractOwner, poolManagerWallet, lenderWallet, addr1, addr2, ...addrs] = await ethers.getSigners();
    creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress);
    lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress);
    vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
    metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress);
    vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
    await accessControlFacet.initializeAccessControl();
    const ERC20Token = await ethers.getContractFactory('ERC20Mock');
    const erc20Token = await ERC20Token.deploy();
    await erc20Token.deployed();
    paymentToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
    await vaultFacet.initializePaymentToken(paymentToken.address);
    await stableCoinExtension.updateWhitelist(paymentToken.address);
    await paymentToken.transfer(lenderWallet.address, 100);
    await paymentToken.transfer(poolManagerWallet.address, 100);
    paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
    await paymentToken.approve(diamondAddress, 100);
    await lenderFacet.createLender(lenderId1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED)
    await vaultFacetLender.deposit(lenderId1, paymentToken.address, 100);
    paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
    await paymentToken.approve(diamondAddress, 100);
  })

  describe("Create pool manager", async function () {
    describe("when sender doesn't have ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr1);
        })
        it("create pool manager fails", async function() {
            await expect(
                poolManagerFacet.createPoolManager(id1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING)
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_CREATE_MANAGER);
            await poolManagerFacet.createPoolManager(id1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
        })
        describe("when pool manager id already exists", async function() {
            it("create pool manager fails", async function() {
                await expect(
                    poolManagerFacet.createPoolManager(id1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING)
                ).to.be.revertedWithCustomError(poolManagerFacet, "PoolManagerIdExist");
            })
            it('should return pool manager', async () => {
                const poolManager = await poolManagerFacet.getPoolManager(id1);
                assert.equal(poolManager.poolManagerId, id1);
                assert.equal(poolManager.metaHash, metaHash);
                assert.equal(poolManager.country, country);
                assert.equal(poolManager.onBoardTime, onBoardTime);
                assert.equal(poolManager.wallet, poolManagerWallet.address);
                assert.equal(poolManager.status, KYBStatus.VERIFIED);
            })
            it('should return pool manager userId', async () => {
                const poolManagerUserId = await poolManagerFacet.getPoolManagerUserId(id1);
                assert.equal(poolManagerUserId, userId1);
            })
            it('should return pool manager meta hash', async () => {
                const poolManagerHash = await poolManagerFacet.getPoolManagerMetaHash(id1);
                assert.equal(poolManagerHash, metaHash);
            })
            it('should return pool manager country', async () => {
                const poolManagerCountry = await poolManagerFacet.getPoolManagerCountry(id1);
                assert.equal(poolManagerCountry, country);
            })
            it('should return pool manager on boarding time', async () => {
                const poolManagerOnBoardTime = await poolManagerFacet.getPoolManagerOnBoardTime(id1);
                assert.equal(poolManagerOnBoardTime, onBoardTime);
            })
            it('should return pool manager wallet address', async () => {
                const wallet = await poolManagerFacet.getPoolManagerWallet(id1);
                assert.equal(wallet, poolManagerWallet.address);
            })
            it('should return pool manager KYB status', async () => {
                const status = await poolManagerFacet.getPoolManagerKYBStatus(id1);
                assert.equal(status, KYBStatus.VERIFIED);
            })
            it('should return pool manager pool ids length', async () => {
                const length = await poolManagerFacet.getPoolManagerPoolIdsLength(id1);
                assert.equal(length, 0);
            })
            it('should return pool manager payment ids length', async () => {
                const length = await poolManagerFacet.getPoolManagerPaymentIdsLength(id1);
                assert.equal(length, 0);
            })
            it('should return pool id', async () => {
                await stableCoinExtension.createCreditPool(id3, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
                const id = await poolManagerFacet.getPoolManagerPoolId(id1, 0);
                assert.equal(id, id3);
            })
            it('should return payment id', async () => {
                await vaultFacetLender.invest(lenderId1, id3, 10);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacet.receiveInvestmentRequest(id1, id3, 5);
                const paymentInfo = {amount: 5, paymentType: PaymentType.COUPON};
                await vaultFacet.pay(id1, id3, [paymentInfo]);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacet.processReceiveInvestmentRequest(0, true);
                const id = await poolManagerFacet.getPoolManagerPaymentId(id1, 0);
                assert.equal(id, "3");
            })
        })
        describe("when pool manager id do not exist", async function() {
            it('should not create pool manager with null id', async () => {
                await expect(
                    poolManagerFacet.createPoolManager("", userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING)
                ).to.be.revertedWithCustomError(poolManagerFacet, "PoolManagerIdExist")
            })
            it('should create pool manager', async () => {
                await poolManagerFacet.createPoolManager(id2, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING)
                let poolManager = await poolManagerFacet.getPoolManager(id2);
                assert.equal(poolManager.poolManagerId, id2);
                assert.equal(poolManager.userId, userId1);
                assert.equal(poolManager.metaHash, metaHash);
                assert.equal(poolManager.country, country);
                assert.equal(poolManager.onBoardTime, onBoardTime);
                assert.equal(poolManager.wallet, poolManagerWallet.address);
                assert.equal(poolManager.status, KYBStatus.PENDING);
                assert.equal(poolManager.poolIds.length, 0);
                assert.equal(poolManager.paymentIds.length, 0);
            })
            it('should emit a create pool manager event', async () => {
                await expect(poolManagerFacet.createPoolManager(id3, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING))
                .to.emit(poolManagerFacet, "CreatePoolManagerEvent")
                .withArgs([
                    id3,
                    userId1,
                    metaHash,
                    country,
                    onBoardTime,
                    poolManagerWallet.address,
                    KYBStatus.PENDING
                ]);
            })
        })	    
    })   
  })
  
  describe("View pools", async function() {
    let poolIds = [];
    before(async function() {
        poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress);
        await poolManagerFacet.createPoolManager(id4, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
        for(let i = 1; i <= 10; i++) {
            await stableCoinExtension.createCreditPool("pool" + i, id4, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address);
            poolIds.push("pool" + i);
        }
    })
    describe("when trying to retrieve all poolIds in single call", async function () {
        describe("when gas used to return all poolIds is within GAS LIMIT", async function() {
            it('should return pool ids', async () => {
                const ids = await poolManagerFacet.getPoolManagerPoolIds(id4);
                expect(poolIds).to.eql(ids);
            })
        })
        describe("when gas used to return all poolIds is out of GAS LIMIT", async function() {
            it('should not return pool ids', async () => {
                await expect(poolManagerFacet.getPoolManagerPoolIds(id4, {gasLimit: 1000})).to.be.reverted;
            })
        })    
    })
    describe("otherwise", async function () {
        let length;
        let ids = [];
        it('should return pool ids length', async () => {
            length = await poolManagerFacet.getPoolManagerPoolIdsLength(id4);
            assert.equal(length, poolIds.length);
        })
        it('should return pool id of given index', async () => {
            for(let i = 0; i < length; i++) {
                const id = await poolManagerFacet.getPoolManagerPoolId(id4, i);
                assert.equal(id, poolIds[i]);
                ids.push(id);
            }
            expect(poolIds).to.eql(ids);
        })
    })
  })

  describe("Update pool manager", async function () {
    describe("when sender doesn't have ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr1);
        })
        it("update pool manager hash fails", async function() {
            await expect(
                poolManagerFacet.updatePoolManagerHash(id1, "0x1")
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("update pool manager country fails", async function() {
            await expect(
                poolManagerFacet.updatePoolManagerCountry(id1, "India")
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("update pool manager onboarding time fails", async function() {
            await expect(
                poolManagerFacet.updatePoolManagerOnBoardTime(id1, onBoardTime + 100)
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("update pool manager wallet fails", async function() {
            await expect(
                poolManagerFacet.updatePoolManagerWallet(id1, addr1.address)
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("update pool manager KYB status fails", async function() {
            await expect(
                poolManagerFacet.updatePoolManagerKYB(id1, KYBStatus.VERIFIED)
            ).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("remove payment id fails", async function() {
            await expect(poolManagerFacet.removePoolManagerPaymentId(id1, "3"))
            .to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
        it("remove payment id by index fails", async function() {
            await expect(poolManagerFacet.removePoolManagerPaymentIdByIndex(id1, 0))
            .to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_EDIT_MANAGER);
        })
        describe("when pool manager id not exist", async function () {
            it("fails to update pool manager hash", async function() {
                await expect(
                    poolManagerFacet.updatePoolManagerHash("", "0x1")
                ).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId")
            })
            it("fails to update pool manager country", async function() {
                await expect(
                    poolManagerFacet.updatePoolManagerCountry("", "India")
                ).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId")
            })
            it("fails to update lender onboarding time", async function() {
                await expect(
                    poolManagerFacet.updatePoolManagerOnBoardTime("", onBoardTime + 100)
                ).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId")
            })
            it("fails to update lender wallet", async function() {
                await expect(
                    poolManagerFacet.updatePoolManagerWallet("", addr1.address)
                ).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId")
            })
            it("fails to update lender KYB", async function() {
                await expect(
                    poolManagerFacet.updatePoolManagerKYB("", KYBStatus.VERIFIED)
                ).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId")
            })    
        })
        describe("succeed otherwise", async function () {
            before(async function () {
                await poolManagerFacet.updatePoolManagerHash(id1, "0x1");
                await poolManagerFacet.updatePoolManagerCountry(id1, "India");
                await poolManagerFacet.updatePoolManagerOnBoardTime(id1, onBoardTime + 100);
                await poolManagerFacet.updatePoolManagerWallet(id1, addr1.address);
                await poolManagerFacet.updatePoolManagerKYB(id1, KYBStatus.VERIFIED);    
            })
            it("should update pool manager hash", async function() {
                expect(await poolManagerFacet.getPoolManagerMetaHash(id1)).to.be.equal("0x1");
            })
            it('should emit an update pool manager hash event', async () => {
                let prevHash = await poolManagerFacet.getPoolManagerMetaHash(id1); 
                await expect(poolManagerFacet.updatePoolManagerHash(id1, "0x"))
                .to.emit(poolManagerFacet, "UpdatePoolManagerHashEvent")
                .withArgs(id1, prevHash, "0x");
            })
            it("should update pool manager country", async function() {
                expect(await poolManagerFacet.getPoolManagerCountry(id1)).to.be.equal("India");
            })
            it('should emit an update pool manager country event', async () => {
                let prevCountry = await poolManagerFacet.getPoolManagerCountry(id1); 
                await expect(poolManagerFacet.updatePoolManagerCountry(id1, country))
                .to.emit(poolManagerFacet, "UpdatePoolManagerCountryEvent")
                .withArgs(id1, prevCountry, country);
            })
            it("should update pool manager onboarding time", async function() {
                expect(await poolManagerFacet.getPoolManagerOnBoardTime(id1)).to.be.equal(onBoardTime + 100);
            })
            it('should emit an update pool manager onboarding time event', async () => {
                let prevTime = await poolManagerFacet.getPoolManagerOnBoardTime(id1); 
                await expect(poolManagerFacet.updatePoolManagerOnBoardTime(id1, onBoardTime))
                .to.emit(poolManagerFacet, "UpdatePoolManagerOnBoardTimeEvent")
                .withArgs(id1, prevTime, onBoardTime);
            })
            it("should update pool manager wallet", async function() {
                expect(await poolManagerFacet.getPoolManagerWallet(id1)).to.be.equal(addr1.address);
            })
            it('should emit an update pool manager wallet event', async () => {
                let prevWallet = await poolManagerFacet.getPoolManagerWallet(id1); 
                await expect(poolManagerFacet.updatePoolManagerWallet(id1, poolManagerWallet.address))
                .to.emit(poolManagerFacet, "UpdatePoolManagerWalletEvent")
                .withArgs(id1, prevWallet, poolManagerWallet.address);
            })
            it("should update pool manager KYB status", async function() {
                expect(await poolManagerFacet.getPoolManagerKYBStatus(id1)).to.be.equal(KYBStatus.VERIFIED);
            })
            it('should emit an update pool manager KYB status event', async () => {
                let prevStatus = await poolManagerFacet.getPoolManagerKYBStatus(id1); 
                await expect(poolManagerFacet.updatePoolManagerKYB(id1, KYBStatus.REJECTED))
                .to.emit(poolManagerFacet, "UpdatePoolManagerKYBEvent")
                .withArgs(id1, prevStatus, KYBStatus.REJECTED);
            })
            it('should remove payment id', async () => {
                poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, contractOwner);
                await poolManagerFacet.removePoolManagerPaymentId(id1, "3");
                const id = await poolManagerFacet.getPoolManagerPaymentId(id1, 0);
                assert.equal(id, "4");
            })
            it('should remove payment id by index', async () => {
                await poolManagerFacet.removePoolManagerPaymentIdByIndex(id1, 0);
                const length = await poolManagerFacet.getPoolManagerPaymentIdsLength(id1);
                assert.equal(length, 0);
            })    
        })   
    })
  })

  describe("Delete pool manager", async function () {
    describe("when sender doesn't have ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr1);
        })
        it("delete pool manager fails", async function() {
            await expect(poolManagerFacet.deletePoolManager(id1)).to.be.revertedWithCustomError(poolManagerFacet, "AccessDenied");
        })
    })    
    describe("when sender has ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_DELETE_MANAGER);
        })
        describe("when poolIds exist", async function () {
            await expect(poolManagerFacet.deletePoolManager(id1)).to.be.revertedWithCustomError(poolManagerFacet, "PoolIdsExist");
        })
        describe("when poolIds do not exist", async function () {
            before(async function() {
                await poolManagerFacet.deletePoolManager(id2);
            })  
            it("should delete pool manager", async function() {
                const poolManager = await poolManagerFacet.getPoolManager(id2);
                assert.equal(poolManager.poolManagerId, "");
                assert.equal(poolManager.userId, "");
                assert.equal(poolManager.wallet, ethers.constants.AddressZero);
                assert.equal(poolManager.status, KYBStatus.PENDING);
                assert.equal(poolManager.poolIds.length, 0);
                assert.equal(poolManager.paymentIds.length, 0);
            })
            it('should emit a delete pool manager event', async () => {
                await expect(poolManagerFacet.deletePoolManager(id3))
                .to.emit(poolManagerFacet, "DeletePoolManagerEvent")
                .withArgs(id3);
            })
            it('should allow to create new pool manager with deleted id', async () => {
                poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress, contractOwner);
                await poolManagerFacet.createPoolManager(id2, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.PENDING)
                const poolManager = await poolManagerFacet.getPoolManager(id2);
                assert.equal(poolManager.poolManagerId, id2);
                assert.equal(poolManager.userId, userId1);
                assert.equal(poolManager.wallet, poolManagerWallet.address);
                assert.equal(poolManager.status, KYBStatus.PENDING);
                assert.equal(poolManager.poolIds.length, 0);
                assert.equal(poolManager.paymentIds.length, 0);
            })    
        })
    })
  })

  describe("View metadata URI", async function () {
    before(async function () {
        await metadataFacet.updateBaseURI(baseURI);
    })
    describe("when pool manager id do not exist", async function () {
        it("should not return metadata URI", async function() {
            await expect(poolManagerFacet.getPoolManagerMetadataURI("Invalid")).to.be.revertedWithCustomError(poolManagerFacet, "InvalidPoolManagerId");
        })
    })
    describe("when pool manager id exists", async function () {
        it("should return empty string if baseURI is not set", async function() {
            await metadataFacet.updateBaseURI("");
            expect(await poolManagerFacet.getPoolManagerMetadataURI(id1)).to.be.equal("");
        })
        it("should return metadata URI constructed using baseURI and metaHash", async function() {
            await metadataFacet.updateBaseURI(baseURI);
            const metaHash = await poolManagerFacet.getPoolManagerMetaHash(id1);
            expect(await poolManagerFacet.getPoolManagerMetadataURI(id1)).to.be.equal(baseURI + metaHash);
        })
    })
  })
})