/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')
  
const { assert, expect } = require('chai')

describe('CreditPoolFacetTest', async function () {
  let diamondAddress
  let poolManagerFacet
  let creditPoolFacet
  let creditPoolFacetOwner
  let lenderFacet
  let vaultFacet
  let paymentToken
  let contractOwner
  let poolManagerWallet
  let metadataFacet
  let accessControlFacet
  let stableCoinExtension
  let lenderWallet
  let addr1
  let addr2
  let addrs
  const borrowingAmount = 10000
  const inceptionTime = 1690792254
  const expiryTime = 1722414654
  const onBoardTime = 1690792254
  const country = "USA"
  const metaHash = "0x"
  const baseURI = "https://csigma.finance/"
  const curingPeriod = 1
  const ROLE_CREATE_MANAGER = 0x0001_0000;
  const ROLE_DELETE_MANAGER = 0x0002_0000;
  const ROLE_EDIT_MANAGER = 0x0004_0000;
  const [poolId1, poolId2, poolId3, poolId4] = ["pool1", "pool2", "pool3", "pool4"]
  const [id1, userId1, userId2, lenderId1, lenderId2] = ["Alice", "user1", "user2", "lender1", "lender2"]
  enum CreditRatings {PENDING, AAA, AA, A, BBB, BB, B, CCC, CC, C}
  enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}
  enum BindingIndex {POOL1, POOL2, POOL3}
  enum KYBStatus {PENDING, VERIFIED, REJECTED}
  enum PaymentType {INVESTMENT, PANDC, DEPOSIT, WITHDRAW, FEE, EXIT, PRINCIPAL, COUPON, PASTDUE}

  before(async function () {
    diamondAddress = await deployDiamond();
    [contractOwner, poolManagerWallet, lenderWallet, addr1, addr2, ...addrs] = await ethers.getSigners();
    poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress);
    lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress);
    vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress);
    metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress);
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
    await accessControlFacet.initializeAccessControl();
    const ERC20Token = await ethers.getContractFactory('ERC20Mock');
    const erc20Token = await ERC20Token.deploy();
    await erc20Token.deployed();
    paymentToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
    await vaultFacet.initializePaymentToken(paymentToken.address);
    await stableCoinExtension.updateWhitelist(paymentToken.address);
  })

  describe("Create credit pool", async function () {
    describe("when sender doesn't have ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr1);
            stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr1);
        })
        it("create credit pool fails", async function() {
            await expect(
                stableCoinExtension.createCreditPool(poolId1, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address)
            ).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_CREATE_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr2);
            stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_CREATE_MANAGER);
            await poolManagerFacet.createPoolManager(id1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
            await stableCoinExtension.createCreditPool(poolId1, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address);
        })
        describe("when credit pool id already exists", async function() {
            it("create credit pool fails", async function() {
                await expect(
                    stableCoinExtension.createCreditPool(poolId1, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address)
                ).to.be.revertedWithCustomError(stableCoinExtension, "CreditPoolIdExist")
            })
            it('should return credit pool', async () => {
                const creditPool = await creditPoolFacet.getCreditPool(poolId1);
                assert.equal(creditPool.creditPoolId, poolId1);
                assert.equal(creditPool.poolManagerId, id1);
                assert.equal(creditPool.metaHash, metaHash);
                assert.equal(creditPool.borrowingAmount, borrowingAmount);
                assert.equal(creditPool.inceptionTime, inceptionTime);
                assert.equal(creditPool.expiryTime, expiryTime);
                assert.equal(creditPool.curingPeriod, curingPeriod);
                assert.equal(creditPool.ratings, CreditRatings.PENDING);
                assert.equal(creditPool.bindingIndex, BindingIndex.POOL1);
                assert.equal(creditPool.status, CreditPoolStatus.PENDING);
            })
            it('should return credit pool poolManagerId', async () => {
                const poolManagerId = await creditPoolFacet.getCreditPoolManagerId(poolId1);
                assert.equal(poolManagerId, id1);
            })
            it('should return credit pool meta hash', async () => {
                const hash = await creditPoolFacet.getCreditPoolMetaHash(poolId1);
                assert.equal(hash, metaHash);
            })
            it('should return credit pool borrowing amount', async () => {
                const amount = await creditPoolFacet.getCreditPoolBorrowingAmount(poolId1);
                assert.equal(amount, borrowingAmount);
            })
            it('should return credit pool inception time', async () => {
                const time = await creditPoolFacet.getCreditPoolInceptionTime(poolId1);
                assert.equal(time, inceptionTime);
            })
            it('should return credit pool expiry time', async () => {
                const time = await creditPoolFacet.getCreditPoolExpiryTime(poolId1);
                assert.equal(time, expiryTime);
            })
            it('should return credit pool curing period', async () => {
                const period = await creditPoolFacet.getCreditPoolCuringPeriod(poolId1);
                assert.equal(curingPeriod, period);
            })
            it('should return credit pool ratings', async () => {
                const poolRatings = await creditPoolFacet.getCreditPoolRatings(poolId1);
                assert.equal(poolRatings, CreditRatings.PENDING);
            })
            it('should return credit pool binding index', async () => {
                const index = await creditPoolFacet.getCreditPoolBindingIndex(poolId1);
                assert.equal(index, BindingIndex.POOL1);
            })
            it('should return credit pool status', async () => {
                const status = await creditPoolFacet.getCreditPoolStatus(poolId1);
                assert.equal(status, CreditPoolStatus.PENDING);
            })
            it('should return credit pool lender ids length', async () => {
                const length = await creditPoolFacet.getCreditPoolLenderIdsLength(poolId1);
                assert.equal(length, 0);
            })
            it('should return credit pool payment ids length', async () => {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                assert.equal(length, 0);
            })
            it('should bound with pool manager state', async () => {
                const poolManagerPoolId = await poolManagerFacet.getPoolManagerPoolId(id1, BindingIndex.POOL1);
                assert.equal(poolManagerPoolId, poolId1);
            })
        })
        describe("when credit pool id do not exist", async function() {
            it('should not create credit pool with null id', async () => {
                await expect(
                    stableCoinExtension.createCreditPool("", id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address)
                ).to.be.revertedWithCustomError(stableCoinExtension, "CreditPoolIdExist")
            })
            it('should not create credit pool if pool manager is not KYB verified', async () => {
                await expect(
                    stableCoinExtension.createCreditPool(poolId2, "", metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address)
                ).to.be.revertedWithCustomError(stableCoinExtension, "NotVerifiedPoolManager")
            })
            it('should create credit pool', async () => {
                await stableCoinExtension.createCreditPool(poolId2, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address)
                let creditPool = await creditPoolFacet.getCreditPool(poolId2);
                assert.equal(creditPool.creditPoolId, poolId2);
                assert.equal(creditPool.poolManagerId, id1);
                assert.equal(creditPool.metaHash, metaHash);
                assert.equal(creditPool.borrowingAmount, borrowingAmount);
                assert.equal(creditPool.inceptionTime, inceptionTime);
                assert.equal(creditPool.expiryTime, expiryTime);
                assert.equal(creditPool.curingPeriod, curingPeriod);
                assert.equal(creditPool.ratings, CreditRatings.PENDING);
                assert.equal(creditPool.bindingIndex, BindingIndex.POOL2);
                assert.equal(creditPool.status, CreditPoolStatus.PENDING);
                assert.equal(creditPool.lenderIds.length, 0);
                assert.equal(creditPool.paymentIds.length, 0);
            })
            it('should emit a create credit pool event', async () => {
                await expect(stableCoinExtension.createCreditPool(poolId3, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address))
                .to.emit(stableCoinExtension, "CreateCreditPoolEvent")
                .withArgs([
                    poolId3,
                    id1,
                    metaHash,
                    borrowingAmount,
                    inceptionTime,
                    expiryTime,
                    curingPeriod,
                    CreditRatings.PENDING,
                    BindingIndex.POOL3,
                    CreditPoolStatus.PENDING
                ]);
            })
            it('should add credit pool id to pool manager state', async () => {
                let poolManagerPoolId2 = await poolManagerFacet.getPoolManagerPoolId(id1, BindingIndex.POOL2);
                let poolManagerPoolId3 = await poolManagerFacet.getPoolManagerPoolId(id1, BindingIndex.POOL3);
                assert.equal(poolManagerPoolId2, poolId2);
                assert.equal(poolManagerPoolId3, poolId3);
            })
        })	    
    })   
  })

  describe("Set / Update credit pool ratings", async function () {
    describe("when sender doesn't have ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr1);
        })
        it("update credit pool ratings fails", async function() {
            await expect(
                creditPoolFacet.updateCreditRatings(poolId1, CreditRatings.AAA)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr2);
            creditPoolFacetOwner = await ethers.getContractAt('CreditPoolFacet', diamondAddress, contractOwner);
            await accessControlFacet.updateRole(addr2.address, ROLE_EDIT_MANAGER);
        })  
        describe("when pool is not active", async function () {
            it("update credit pool ratings fails", async function() {
                await expect(creditPoolFacet.updateCreditRatings(poolId1, CreditRatings.AAA)).to.be.revertedWithCustomError(creditPoolFacet, "PoolIsNotActive");
            })    
        })
        describe("otherwise", async function () {
            before(async function() {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
                await stableCoinExtension.createCreditPool(poolId4, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address)
                await creditPoolFacet.updateCreditRatings(poolId4, CreditRatings.AAA);
            })
            it("should update credit pool ratings", async function() {
                expect(await creditPoolFacet.getCreditPoolRatings(poolId4)).to.be.equal(CreditRatings.AAA);
            })
            it('should emit an update credit ratings event', async () => {
                const prevRatings = await creditPoolFacet.getCreditPoolRatings(poolId4); 
                await expect(creditPoolFacet.updateCreditRatings(poolId4, CreditRatings.C))
                .to.emit(creditPoolFacet, "UpdateCreditRatingsEvent")
                .withArgs(poolId4, prevRatings, CreditRatings.C);
            })        
        })  
    })  
  })

  describe("Update credit pool", async function () {
    describe("when sender doesn't have ROLE_EDIT_MANAGER permission", async function () {
        before(async function () {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, contractOwner);
            await lenderFacet.createLender(lenderId1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
            await lenderFacet.createLender(lenderId2, userId2, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
            await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
            await creditPoolFacet.updateCreditPoolStatus(poolId2, CreditPoolStatus.ACTIVE);
            await paymentToken.transfer(lenderWallet.address, 200);
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
            await paymentToken.approve(diamondAddress, 200);
            await vaultFacet.deposit(lenderId1, paymentToken.address, 100);
            await vaultFacet.deposit(lenderId2, paymentToken.address, 100);
        })
        beforeEach(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr1);
        })
        it("update credit pool hash fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolHash(poolId1, "0x1")
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("update credit pool borrowing amount fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, 50000)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("update credit pool inception time fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolInceptionTime(poolId1, inceptionTime + 100)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("update credit pool expiry time fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolExpiryTime(poolId1, expiryTime + 100)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("update credit pool curing period fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolCuringPeriod(poolId1, curingPeriod + 100)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("update credit pool status fails", async function() {
            await expect(
                creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("remove payment id fails", async function() {
            await expect(
                creditPoolFacet.removeCreditPoolPaymentId(poolId1, "1")
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
        it("remove payment id by index fails", async function() {
            await expect(
                creditPoolFacet.removeCreditPoolPaymentIdByIndex(poolId1, 0)
            ).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied")
        })
    })    
    describe("when sender has ROLE_EDIT_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacetOwner = await ethers.getContractAt('CreditPoolFacet', diamondAddress, contractOwner);
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr2);
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            await accessControlFacet.updateRole(addr2.address, ROLE_EDIT_MANAGER);
        })
        describe("update credit pool hash", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolHash("", "0x1")
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolHash(poolId1, "0x1");
                expect(await creditPoolFacet.getCreditPoolMetaHash(poolId1)).to.be.equal("0x1");
            })
            it('should emit an update credit pool hash event', async () => {
                const prevHash = await creditPoolFacet.getCreditPoolMetaHash(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolHash(poolId1, "0x"))
                .to.emit(creditPoolFacet, "UpdateCreditPoolHashEvent")
                .withArgs(poolId1, prevHash, "0x");
            })    
        })
        describe("update credit pool inception time", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolInceptionTime("", inceptionTime + 100)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolInceptionTime(poolId1, inceptionTime + 100);
                expect(await creditPoolFacet.getCreditPoolInceptionTime(poolId1)).to.be.equal(inceptionTime + 100);
            })
            it('should emit an update credit pool inception time event', async () => {
                const prevTime = await creditPoolFacet.getCreditPoolInceptionTime(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolInceptionTime(poolId1, inceptionTime))
                .to.emit(creditPoolFacet, "UpdateCreditPoolInceptionTimeEvent")
                .withArgs(poolId1, prevTime, inceptionTime);
            })    
        })
        describe("update credit pool expiry time", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolExpiryTime("", expiryTime + 100)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolExpiryTime(poolId1, expiryTime + 100);
                expect(await creditPoolFacet.getCreditPoolExpiryTime(poolId1)).to.be.equal(expiryTime + 100);
            })
            it('should emit an update credit pool expiry time event', async () => {
                const prevTime = await creditPoolFacet.getCreditPoolExpiryTime(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolExpiryTime(poolId1, expiryTime))
                .to.emit(creditPoolFacet, "UpdateCreditPoolExpiryTimeEvent")
                .withArgs(poolId1, prevTime, expiryTime);
            })    
        })
        describe("update credit pool curing period", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolCuringPeriod("", curingPeriod + 100)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolCuringPeriod(poolId1, curingPeriod + 100);
                expect(await creditPoolFacet.getCreditPoolCuringPeriod(poolId1)).to.be.equal(curingPeriod + 100);
            })
            it('should emit an update credit pool curing period event', async () => {
                const prevPeriod = await creditPoolFacet.getCreditPoolCuringPeriod(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolCuringPeriod(poolId1, curingPeriod))
                .to.emit(creditPoolFacet, "UpdateCreditPoolCuringPeriodEvent")
                .withArgs(poolId1, prevPeriod, curingPeriod);
            })    
        }) 
        describe("update credit pool status", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolStatus("", CreditPoolStatus.INACTIVE)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.INACTIVE);
                expect(await creditPoolFacet.getCreditPoolStatus(poolId1)).to.be.equal(CreditPoolStatus.INACTIVE);
            })
            it('should emit an update credit pool status event', async () => {
                const prevState = await creditPoolFacet.getCreditPoolStatus(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE))
                .to.emit(creditPoolFacet, "UpdateCreditPoolStatusEvent")
                .withArgs(poolId1, prevState, CreditPoolStatus.ACTIVE);
            })    
        })
        describe("add lender id", async function () {
            describe("when pool is not active", async function () {
                it("fails", async function () {
                    await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.INACTIVE);
                    await expect(vaultFacet.invest(lenderId1, poolId1, 10))
                    .to.be.revertedWithCustomError(creditPoolFacet, "PoolIsNotActive")
                })
            })
            describe("when pool is active", async function () {
                describe("when lender is not verified", async function () {
                    it("fails", async function () {
                        await creditPoolFacet.updateCreditPoolStatus(poolId1, CreditPoolStatus.ACTIVE);
                        await lenderFacet.updateLenderKYB(lenderId1, KYBStatus.PENDING);
                        await expect(vaultFacet.invest(lenderId1, poolId1, 10))
                        .to.be.revertedWithCustomError(vaultFacet, "NotVerifiedLender")
                    })    
                })
                describe("when lender is verified", async function () {
                    let lenderBinding1, lenderBinding2;
                    before(async function() {
                        await lenderFacet.updateLenderKYB(lenderId1, KYBStatus.VERIFIED);
                        await vaultFacet.invest(lenderId1, poolId1, 10);
                        await vaultFacet.invest(lenderId2, poolId1, 10);
                    })
                    it("succeed", async function () {
                        lenderBinding1 = await creditPoolFacet.getLenderBinding(lenderId1, poolId1);
                        lenderBinding2 = await creditPoolFacet.getLenderBinding(lenderId2, poolId1);
                        assert.equal(lenderBinding1.isBound, true);
                        assert.equal(lenderBinding1.poolIndexInLender, 0);
                        assert.equal(lenderBinding1.lenderIndexInPool, 0);
                        assert.equal(lenderBinding2.isBound, true);
                        assert.equal(lenderBinding2.poolIndexInLender, 0);
                        assert.equal(lenderBinding2.lenderIndexInPool, 1);
                        expect(await creditPoolFacet.getCreditPoolLenderId(
                            poolId1, lenderBinding1.lenderIndexInPool
                        )).to.be.equal(lenderId1);
                        expect(await creditPoolFacet.getCreditPoolLenderId(
                            poolId1, lenderBinding2.lenderIndexInPool
                        )).to.be.equal(lenderId2);
                        expect(await creditPoolFacet.getCreditPoolLenderIdsLength(poolId1)).to.be.equal(2);
                    })
                    it("should add poolId to lender", async function () {
                        expect(await lenderFacet.getLenderPoolId(
                            lenderId1, lenderBinding1.poolIndexInLender
                        )).to.be.equal(poolId1);
                        expect(await lenderFacet.getLenderPoolId(
                            lenderId2, lenderBinding2.poolIndexInLender
                        )).to.be.equal(poolId1);
                    })
                })        
            })
        })
        describe("remove lender id", async function () {
            before(async function() {
                await creditPoolFacet.updateCreditPoolStatus(poolId2, CreditPoolStatus.ACTIVE);
                vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacet.invest(lenderId1, poolId2, 10);
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
                    roleId: lenderId1,
                    poolId: poolId1,
                    paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],
                };
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address);
                await paymentToken.transfer(poolManagerWallet.address, 100);
                paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
                await paymentToken.approve(diamondAddress, 100);
                const vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacetPM.pay(id1, poolId1, [{amount: 10, paymentType: PaymentType.EXIT}]);
                const distributeFacetLender = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
                await distributeFacetLender.withdrawPoolPaymentIntoVault(message, r, s, v);
            })
            it("succeed", async function () {
                const lenderBinding = await creditPoolFacet.getLenderBinding(lenderId1, poolId1);
                assert.equal(lenderBinding.isBound, false);
                assert.equal(lenderBinding.poolIndexInLender, 0);
                assert.equal(lenderBinding.lenderIndexInPool, 0);
                expect(await creditPoolFacet.getCreditPoolLenderIdsLength(poolId1)).to.be.equal(1);
            })
            it("should remove poolId from lender", async function () {
                expect(await lenderFacet.getLenderPoolIdsLength(lenderId1)).to.be.equal(1);
            })
            it("should replace removed poolId with last poolId", async function () {
                expect(await lenderFacet.getLenderPoolId(lenderId1, 0)).to.be.equal(poolId2);
            })
            it("should update last poolId index inside lender binding", async function () {
                const lenderBinding = await creditPoolFacet.getLenderBinding(lenderId1, poolId2);
                assert.equal(lenderBinding.poolIndexInLender, 0);
            })
            it("should replace removed lenderId with last lenderId", async function () {
                expect(await creditPoolFacet.getCreditPoolLenderId(poolId1, 0)).to.be.equal(lenderId2);
            })
        })
        describe("remove payment id", async function () {
            it('should remove payment id', async () => {
                const id = await creditPoolFacet.getCreditPoolPaymentId(poolId1, 0);
                const prevLength = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                await creditPoolFacetOwner.removeCreditPoolPaymentId(poolId1, id);
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                assert.equal(length, Number(prevLength) - 1);
            })
            it('should remove payment id by index', async () => {
                const prevLength = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                await creditPoolFacetOwner.removeCreditPoolPaymentIdByIndex(poolId1, 0);
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId1);
                assert.equal(length, Number(prevLength) - 1);
            })
        })
        describe("update credit pool borrowing amount", async function () {
            it("fails if credit pool id not exist", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolBorrowingAmount("", 5)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId")
            })
            it("fails if borrowing amount is less than borrowed amount", async function() {
                await expect(
                    creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, 5)
                ).to.be.revertedWithCustomError(creditPoolFacet, "InvalidAmount")
            })
            it("succeed", async function() {
                await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, borrowingAmount + 100);
                expect(await creditPoolFacet.getCreditPoolBorrowingAmount(poolId1)).to.be.equal(borrowingAmount + 100);
            })
            it('should emit an update credit pool borrowing amount event', async () => {
                const prevAmount = await creditPoolFacet.getCreditPoolBorrowingAmount(poolId1); 
                await expect(creditPoolFacet.updateCreditPoolBorrowingAmount(poolId1, borrowingAmount))
                .to.emit(creditPoolFacet, "UpdateCreditPoolBorrowingAmountEvent")
                .withArgs(poolId1, prevAmount, borrowingAmount);
            })    
        })
    })  
  })

  describe("Delete credit pool", async function () {
    describe("when sender doesn't have ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr1);
        })
        it("delete credit pool fails", async function() {
            await expect(creditPoolFacet.deleteCreditPool(poolId1)).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied");
        })
    })    
    describe("when sender has ROLE_DELETE_MANAGER permission", async function () {
        before(async function() {
            creditPoolFacetOwner = await ethers.getContractAt('CreditPoolFacet', diamondAddress, contractOwner);
            creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_DELETE_MANAGER);
        })
        describe("when lenderIds exist", async function () {
            await expect(creditPoolFacet.deleteCreditPool(poolId1)).to.be.revertedWithCustomError(creditPoolFacet, "LenderIdsExist");
        })
        describe("when lenderIds do not exist", async function () {
            before(async function() {
                await creditPoolFacet.deleteCreditPool(poolId4);
            }) 
            it("should delete credit pool", async function() {
                const creditPool = await creditPoolFacet.getCreditPool(poolId4);
                assert.equal(creditPool.creditPoolId, "");
                assert.equal(creditPool.poolManagerId, "");
                assert.equal(creditPool.ratings, CreditRatings.PENDING);
                assert.equal(creditPool.bindingIndex, 0);
                assert.equal(creditPool.status, CreditPoolStatus.PENDING);
                assert.equal(creditPool.lenderIds.length, 0);
                assert.equal(creditPool.paymentIds.length, 0);
            })
            it('should emit a delete credit pool event', async () => {
                await expect(creditPoolFacet.deleteCreditPool(poolId3))
                .to.emit(creditPoolFacet, "DeleteCreditPoolEvent")
                .withArgs(poolId3);
            })
            it('should allow to create new credit pool with deleted id', async () => {
                stableCoinExtension.createCreditPool(poolId3, id1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.PENDING, paymentToken.address);
                const creditPool = await creditPoolFacet.getCreditPool(poolId3);
                assert.equal(creditPool.creditPoolId, poolId3);
                assert.equal(creditPool.poolManagerId, id1);
                assert.equal(creditPool.ratings, CreditRatings.PENDING);
                assert.equal(creditPool.bindingIndex, 2);
                assert.equal(creditPool.status, CreditPoolStatus.PENDING);
                assert.equal(creditPool.lenderIds.length, 0);
                assert.equal(creditPool.paymentIds.length, 0);
            })
            it("should remove poolId from pool manager", async function () {
                expect(await poolManagerFacet.getPoolManagerPoolIdsLength(id1)).to.be.equal(3);
            })
            it("should replace removed poolId with last poolId", async function () {
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
                    nonce: 2,
                    roleId: lenderId1,
                    poolId: poolId2,
                    paymentInfo: [{amount: 10, paymentType: PaymentType.EXIT}],
                };
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                const vaultFacetPM = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacetPM.pay(id1, poolId2, [{amount: 10, paymentType: PaymentType.EXIT}]);
                const distributeFacetLender = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
                await distributeFacetLender.withdrawPoolPaymentIntoVault(message, r, s, v);
                await creditPoolFacet.deleteCreditPool(poolId2);
                expect(await poolManagerFacet.getPoolManagerPoolId(id1, 1)).to.be.equal(poolId3);
            })
            it("should update binding index of last poolId", async function () {
                const index = await creditPoolFacet.getCreditPoolBindingIndex(poolId3);
                assert.equal(index, 1);
            })    
        })
    })
  })

  describe("View metadata URI", async function () {
    before(async function () {
        await metadataFacet.updateBaseURI(baseURI);
    })
    describe("when pool id do not exist", async function () {
        it("should not return metadata URI", async function() {
            await expect(creditPoolFacet.getCreditPoolMetadataURI("Invalid")).to.be.revertedWithCustomError(creditPoolFacet, "InvalidPoolId");
        })
    })
    describe("when pool id exists", async function () {
        it("should return empty string if baseURI is not set", async function() {
            await metadataFacet.updateBaseURI("");
            expect(await creditPoolFacet.getCreditPoolMetadataURI(poolId1)).to.be.equal("");
        })
        it("should return metadata URI constructed using baseURI and metaHash", async function() {
            await metadataFacet.updateBaseURI(baseURI);
            const metaHash = await creditPoolFacet.getCreditPoolMetaHash(poolId1);
            expect(await creditPoolFacet.getCreditPoolMetadataURI(poolId1)).to.be.equal(baseURI + metaHash);
        })
    })
  })
})