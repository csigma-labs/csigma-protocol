/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')
  
const { assert, expect } = require('chai')

describe('LenderFacetTest', async function () {
  let diamondAddress
  let lenderFacet
  let poolManagerFacet
  let creditPoolFacet
  let vaultFacet
  let paymentToken
  let contractOwner
  let lenderWallet
  let poolManagerWallet
  let metadataFacet
  let accessControlFacet
  let stableCoinExtension
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
  const [id1, id2, id3, id4, userId1, poolId1, poolId2, poolId3] = ["Alice", "Bob", "Charlie", "David", "cSigmaUser01", "pool1", "pool2", "pool3"]
  enum KYBStatus {PENDING, VERIFIED, REJECTED}
  enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}
  enum PaymentType {INVESTMENT, PANDC, DEPOSIT, WITHDRAW, FEE, EXIT, PRINCIPAL, COUPON, PASTDUE}

  before(async function () {
    diamondAddress = await deployDiamond();
    [contractOwner, lenderWallet, poolManagerWallet, addr1, addr2, ...addrs] = await ethers.getSigners();
    creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress);
    poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress);
    vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
    metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress);
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
    await accessControlFacet.initializeAccessControl();
    await poolManagerFacet.createPoolManager(id4, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
    const ERC20Token = await ethers.getContractFactory('ERC20Mock');
    const erc20Token = await ERC20Token.deploy();
    await erc20Token.deployed();
    paymentToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
    await vaultFacet.initializePaymentToken(paymentToken.address);
    await stableCoinExtension.updateWhitelist(paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId1, id4, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId2, id4, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
    await stableCoinExtension.createCreditPool(poolId3, id4, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
  })

  describe("Create lender", async function () {
    describe("when sender doesn't have ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr1);
        })
        it("create lender fails", async function() {
            await expect(
                lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING)
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_CREATE_MANAGER);
            await lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING);
        })
        describe("when lender id already exists", async function() {
            it("create lender fails", async function() {
                await expect(
                    lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING)
                ).to.be.revertedWithCustomError(lenderFacet, "LenderIdExist")    
            })
            it('should return lender', async () => {
                const lender = await lenderFacet.getLender(id1);
                assert.equal(lender.lenderId, id1);
                assert.equal(lender.metaHash, metaHash);
                assert.equal(lender.country, country);
                assert.equal(lender.onBoardTime, onBoardTime);
                assert.equal(lender.wallet, lenderWallet.address);
                assert.equal(lender.status, KYBStatus.PENDING);
            })
            it('should return lender userId', async () => {
                const lenderUserId = await lenderFacet.getLenderUserId(id1);
                assert.equal(lenderUserId, userId1);
            })
            it('should return lender meta hash', async () => {
                const lenderMetaHash = await lenderFacet.getLenderMetaHash(id1);
                assert.equal(lenderMetaHash, metaHash);
            })
            it('should return lender country', async () => {
                const lenderCountry = await lenderFacet.getLenderCountry(id1);
                assert.equal(lenderCountry, country);
            })
            it('should return lender on boarding time', async () => {
                const lenderOnBoardTime = await lenderFacet.getLenderOnBoardTime(id1);
                assert.equal(lenderOnBoardTime, onBoardTime);
            })
            it('should return lender wallet address', async () => {
                const wallet = await lenderFacet.getLenderWallet(id1);
                assert.equal(wallet, lenderWallet.address);
            })
            it('should return lender KYB status', async () => {
                const status = await lenderFacet.getLenderKYBStatus(id1);
                assert.equal(status, KYBStatus.PENDING);
            })
            it('should return lender pool ids length', async () => {
                const length = await lenderFacet.getLenderPoolIdsLength(id1);
                assert.equal(length, 0);
            })
            it('should return lender payment ids length', async () => {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                assert.equal(length, 0);
            })
            it('should return pool id', async () => {
                await paymentToken.transfer(lenderWallet.address, 100);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
                lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, contractOwner);
                await paymentToken.approve(diamondAddress, 100);
                await lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED);
                await vaultFacet.deposit(id1, paymentToken.address, 100);
                await vaultFacet.invest(id1, poolId1, 10);
                const id = await lenderFacet.getLenderPoolId(id1, 0);
                assert.equal(id, poolId1);
            })
            it('should return payment id', async () => {
                const id = await lenderFacet.getLenderPaymentId(id1, 0);
                assert.equal(id, "1");
            })
        })
        describe("when lender id do not exist", async function() {
            it('should not create lender with null id', async () => {
                await expect(
                    lenderFacet.createLender("", userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING)
                ).to.be.revertedWithCustomError(lenderFacet, "LenderIdExist")
            })
            it('should create lender', async () => {
                await lenderFacet.createLender(id2, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING)
                const lender = await lenderFacet.getLender(id2);
                assert.equal(lender.lenderId, id2);
                assert.equal(lender.userId, userId1);
                assert.equal(lender.metaHash, metaHash);
                assert.equal(lender.country, country);
                assert.equal(lender.onBoardTime, onBoardTime);
                assert.equal(lender.wallet, lenderWallet.address);
                assert.equal(lender.status, KYBStatus.PENDING);
                assert.equal(lender.poolIds.length, 0);
                assert.equal(lender.paymentIds.length, 0);
            })
            it('should emit a create lender event', async () => {
                await expect(lenderFacet.createLender(id3, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING))
                .to.emit(lenderFacet, "CreateLenderEvent")
                .withArgs([
                    id3,
                    userId1,
                    metaHash,
                    country,
                    onBoardTime,
                    lenderWallet.address,
                    KYBStatus.PENDING
                ]);
            })
        })	    
    })   
  })

  describe("Update lender", async function () {
    describe("when sender doesn't have ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr1);
        })
        it("update lender hash fails", async function() {
            await expect(
                lenderFacet.updateLenderHash(id1, "0x1")
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("update lender country fails", async function() {
            await expect(
                lenderFacet.updateLenderCountry(id1, "India")
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("update lender on boarding time fails", async function() {
            await expect(
                lenderFacet.updateLenderOnBoardTime(id1, onBoardTime + 100)
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("update lender wallet fails", async function() {
            await expect(
                lenderFacet.updateLenderWallet(id1, addr1.address)
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("update lender KYB status fails", async function() {
            await expect(
                lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED)
            ).to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("remove payment id fails", async function() {
            await expect(lenderFacet.removeLenderPaymentId(id1, "1"))
            .to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
        it("remove payment id by index fails", async function() {
            await expect(lenderFacet.removeLenderPaymentIdByIndex(id1, 0))
            .to.be.revertedWithCustomError(lenderFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_EDIT_MANAGER permission", async function () {
        before(async function () {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_EDIT_MANAGER);
        })
        describe("when lender id not exist", async function () {
            it("fails to update lender hash", async function() {
                await expect(
                    lenderFacet.updateLenderHash("", "0x1")
                ).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId")
            })
            it("fails to update lender country", async function() {
                await expect(
                    lenderFacet.updateLenderCountry("", "India")
                ).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId")
            })
            it("fails to update lender onboarding time", async function() {
                await expect(
                    lenderFacet.updateLenderOnBoardTime("", onBoardTime + 100)
                ).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId")
            })
            it("fails to update lender wallet", async function() {
                await expect(
                    lenderFacet.updateLenderWallet("", addr1.address)
                ).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId")
            })
            it("fails to update lender KYB", async function() {
                await expect(
                    lenderFacet.updateLenderKYB("", KYBStatus.VERIFIED)
                ).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId")
            })    
        })
        describe("succeed otherwise", async function () {
            before(async function() {
                await lenderFacet.updateLenderHash(id1, "0x1");
                await lenderFacet.updateLenderCountry(id1, "India");
                await lenderFacet.updateLenderOnBoardTime(id1, onBoardTime + 100);
                await lenderFacet.updateLenderWallet(id1, addr1.address);
                await lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED);
            })
            it("should update lender hash", async function() {
                expect(await lenderFacet.getLenderMetaHash(id1)).to.be.equal("0x1");
            })
            it('should emit an update lender hash event', async () => {
                let prevHash = await lenderFacet.getLenderMetaHash(id1); 
                await expect(lenderFacet.updateLenderHash(id1, "0x"))
                .to.emit(lenderFacet, "UpdateLenderHashEvent")
                .withArgs(id1, prevHash, "0x");
            })
            it("should update lender country", async function() {
                expect(await lenderFacet.getLenderCountry(id1)).to.be.equal("India");
            })
            it('should emit an update lender country event', async () => {
                let prevCountry = await lenderFacet.getLenderCountry(id1); 
                await expect(lenderFacet.updateLenderCountry(id1, country))
                .to.emit(lenderFacet, "UpdateLenderCountryEvent")
                .withArgs(id1, prevCountry, country);
            })
            it("should update lender on boarding time", async function() {
                expect(await lenderFacet.getLenderOnBoardTime(id1)).to.be.equal(onBoardTime + 100);
            })
            it('should emit an update lender on boarding time event', async () => {
                let prevTime = await lenderFacet.getLenderOnBoardTime(id1); 
                await expect(lenderFacet.updateLenderOnBoardTime(id1, onBoardTime))
                .to.emit(lenderFacet, "UpdateLenderOnBoardTimeEvent")
                .withArgs(id1, prevTime, onBoardTime);
            })
            it("should update lender wallet", async function() {
                expect(await lenderFacet.getLenderWallet(id1)).to.be.equal(addr1.address);
            })
            it('should emit an update lender wallet event', async () => {
                let prevWallet = await lenderFacet.getLenderWallet(id1); 
                await expect(lenderFacet.updateLenderWallet(id1, lenderWallet.address))
                .to.emit(lenderFacet, "UpdateLenderWalletEvent")
                .withArgs(id1, prevWallet, lenderWallet.address);
            })
            it("should update lender KYB status", async function() {
                expect(await lenderFacet.getLenderKYBStatus(id1)).to.be.equal(KYBStatus.VERIFIED);
            })
            it('should emit an update lender KYB status event', async () => {
                let prevStatus = await lenderFacet.getLenderKYBStatus(id1); 
                await expect(lenderFacet.updateLenderKYB(id1, KYBStatus.REJECTED))
                .to.emit(lenderFacet, "UpdateLenderKYBEvent")
                .withArgs(id1, prevStatus, KYBStatus.REJECTED);
            })
            it('should remove payment id', async () => {
                lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, contractOwner);
                await lenderFacet.removeLenderPaymentId(id1, "1");
                const id = await lenderFacet.getLenderPaymentId(id1, 0);
                assert.equal(id, "2");
            })
            it('should remove payment id by index', async () => {
                await lenderFacet.removeLenderPaymentIdByIndex(id1, 0);
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                assert.equal(length, 0);
            })    
        })	    
    })
  })

  describe("Delete lender", async function () {
    describe("when sender doesn't have ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr1);
        })
        it("delete lender fails", async function() {
            await expect(lenderFacet.deleteLender(id1)).to.be.revertedWithCustomError(lenderFacet, "AccessDenied");
        })
    })    
    describe("when sender has ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_DELETE_MANAGER);
        })
        describe("when poolIds exist", async function () {
            await expect(lenderFacet.deleteLender(id1)).to.be.revertedWithCustomError(lenderFacet, "PoolIdsExist");
        })
        describe("when poolIds do not exist", async function () {
            before(async function() {
                await lenderFacet.deleteLender(id2);
            })  
            it("should delete lender", async function() {
                const lender = await lenderFacet.getLender(id2);
                assert.equal(lender.lenderId, "");
                assert.equal(lender.userId, "");
                assert.equal(lender.wallet, ethers.constants.AddressZero);
                assert.equal(lender.status, KYBStatus.PENDING);
                assert.equal(lender.poolIds.length, 0);
                assert.equal(lender.paymentIds.length, 0);
            })
            it('should emit a delete lender event', async () => {
                await expect(lenderFacet.deleteLender(id3))
                .to.emit(lenderFacet, "DeleteLenderEvent")
                .withArgs(id3);
            })
            it('should allow to create new lender with deleted id', async () => {
                lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress, contractOwner);
                await lenderFacet.createLender(id2, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.PENDING)
                const lender = await lenderFacet.getLender(id2);
                assert.equal(lender.lenderId, id2);
                assert.equal(lender.userId, userId1);
                assert.equal(lender.wallet, lenderWallet.address);
                assert.equal(lender.status, KYBStatus.PENDING);
                assert.equal(lender.poolIds.length, 0);
                assert.equal(lender.paymentIds.length, 0);
            })    
        })
    })
  })

  describe("View pools", async function () {
    let poolIds = [poolId1, poolId2, poolId3];
    let vaultFacetLender;
    before(async function() {
        await lenderFacet.updateLenderKYB(id1, KYBStatus.VERIFIED);
        vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
        vaultFacetLender = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
        await vaultFacetLender.invest(id1, poolId2, 10);
        await vaultFacetLender.invest(id1, poolId3, 10);
    })
    describe("when trying to retrieve all poolIds in single call", async function () {
        describe("when gas used to return all poolIds is within GAS LIMIT", async function() {
            it('should return pool ids', async () => {
                const ids = await lenderFacet.getLenderPoolIds(id1);
                expect(poolIds).to.eql(ids);
            })
        })
        describe("when gas used to return all poolIds is out of GAS LIMIT", async function() {
            it('should not return pool ids', async () => {
                await expect(lenderFacet.getLenderPoolIds(id1, {gasLimit: 1000})).to.be.reverted;
            })
        })    
    })
    describe("otherwise", async function () {
        let length;
        let ids = [];
        it('should return pool ids length', async () => {
            length = await lenderFacet.getLenderPoolIdsLength(id1);
            assert.equal(length, poolIds.length);
        })
        it('should return pool id of given index', async () => {
            for(let i = 0; i < length; i++) {
                const id = await lenderFacet.getLenderPoolId(id1, i);
                assert.equal(id, poolIds[i]);
                ids.push(id);
            }
            expect(poolIds).to.eql(ids);
        })
    })
    it('should return invested pool ids only', async () => {
        const distributeFacet = await ethers.getContractAt('DistributeFacet', diamondAddress);
        await distributeFacet.setDomainSeperator();
        const chainId = await paymentToken.getChainId();
        const domain = [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
        ];
        const domainData = {
            name: "cSigmaDiamond",
            version: "1",
            chainId: Number(chainId),
            verifyingContract: diamondAddress,
        };
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
        const message = {
            nonce: 1,
            roleId: id1,
            poolId: poolId3,
            paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],
        };
        const signature = await contractOwner._signTypedData(domainData, types, message);
        const distributeFacetLender = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
        const r = signature.substring(0, 66);
        const s = "0x" + signature.substring(66, 130);
        const v = parseInt(signature.substring(130, 132), 16);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address);
        await paymentToken.transfer(poolManagerWallet.address, 100);
        paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
        await paymentToken.approve(diamondAddress, 100);
        const vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
        await vaultFacetPM.pay(id4, poolId3, [{amount: 10, paymentType: PaymentType.EXIT}]);
        await distributeFacetLender.withdrawPoolPaymentIntoVault(message, r, s, v);
        poolIds.pop();
        const ids = await lenderFacet.getLenderPoolIds(id1);
        expect(poolIds).to.eql(ids);
    })
  })

  describe("View metadata URI", async function () {
    before(async function () {
        await metadataFacet.updateBaseURI(baseURI);
    })
    describe("when lender id do not exist", async function () {
        it("should not return metadata URI", async function() {
            await expect(lenderFacet.getLenderMetadataURI("Invalid")).to.be.revertedWithCustomError(lenderFacet, "InvalidLenderId");
        })
    })
    describe("when lender id exists", async function () {
        it("should return empty string if baseURI is not set", async function() {
            await metadataFacet.updateBaseURI("");
            expect(await lenderFacet.getLenderMetadataURI(id1)).to.be.equal("");
        })
        it("should return metadata URI constructed using baseURI and metaHash", async function() {
            await metadataFacet.updateBaseURI(baseURI);
            const metaHash = await lenderFacet.getLenderMetaHash(id1);
            expect(await lenderFacet.getLenderMetadataURI(id1)).to.be.equal(baseURI + metaHash);
        })
    })
  })
})