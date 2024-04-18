/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')

const { assert, expect } = require('chai')

describe('StableCoinExtensionTest', async function () {
    let diamondAddress
    let lenderFacet
    let creditPoolFacet
    let poolManagerFacet
    let paymentFacet
    let vaultFacet
    let distributeExtension
    let vaultFacetExtension
    let accessControlFacet
    let stableCoinExtension
    let stableCoinExtensionOwner
    let paymentToken
    let contractOwner
    let lenderWallet
    let poolManagerWallet
    let addr1
    let addr2
    let addrs
    let domainData
    const ROLE_CREATE_MANAGER = 0x0001_0000;
    const ROLE_CONFIG_MANAGER = 0x0008_0000;
    const metaHash = "0x"
    const borrowingAmount = 10000
    const inceptionTime = 1690792254
    const expiryTime = 1722414654
    const onBoardTime = 1690792254
    const country = "USA"
    const curingPeriod = 1
    const zeroAddress = "0x0000000000000000000000000000000000000000"
    const [id1, id2, id3, id4, id5, id6, userId1, pmId1, pmId2] = ["Alice", "Bob", "Charlie", "David", "Eric", "Fantom", "cSigmaUser01", "pm01", "pm02"]
    const [poolId1, poolId2, poolId3, poolId4, poolId5, poolId6] = ["pool1", "pool2", "pool3", "pool4", "pool5", "pool6"]
    enum KYBStatus {PENDING, VERIFIED, REJECTED}
    enum CreditPoolStatus {PENDING, ACTIVE, INACTIVE}
    enum PaymentType {INVESTMENT, PANDC, DEPOSIT, WITHDRAW, FEE, EXIT, PRINCIPAL, COUPON, PASTDUE}
    enum CreditRatings {PENDING, AAA, AA, A, BBB, BB, B, CCC, CC, C}
    enum BindingIndex {POOL1, POOL2, POOL3}
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
        paymentFacet = await ethers.getContractAt('PaymentFacet', diamondAddress);
        poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress);
        accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
        stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
        stableCoinExtensionOwner = await ethers.getContractAt('StableCoinExtension', diamondAddress);
        await accessControlFacet.initializeAccessControl();
        const ERC20Token = await ethers.getContractFactory('ERC20Mock');
        const erc20Token = await ERC20Token.deploy();
        await erc20Token.deployed();
        paymentToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
        await vaultFacet.initializePaymentToken(paymentToken.address);
        await vaultFacet.setMinDepositLimit(100);
        await stableCoinExtension.updateWhitelist(paymentToken.address);
        await poolManagerFacet.createPoolManager(pmId1, userId1, metaHash, country, onBoardTime, poolManagerWallet.address, KYBStatus.VERIFIED);
        await creditPoolFacet.createCreditPool(poolId1, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE);
        await stableCoinExtension.initializePoolToken(poolId1, paymentToken.address);
        await lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        await lenderFacet.createLender(id2, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        await lenderFacet.createLender(id3, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        await lenderFacet.createLender(id4, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        await distributeExtension.setDomainSeperator();
        const chainId = await paymentToken.getChainId();
        domainData = {
            name: "cSigmaDiamond",
            version: "1",
            chainId: Number(chainId),
            verifyingContract: diamondAddress,
        };
    })

    describe("Initialize pool token", async function (){
        let poolToken;
        before(async function () {
            await creditPoolFacet.createCreditPool(poolId2, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE);
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);    
        })
        describe("when sender doesn't have ROLE_CREATE_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
            })
            it("fails", async function() {
                await expect(stableCoinExtension.initializePoolToken(poolId2, paymentToken.address)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
        })
        describe("when sender has ROLE_CREATE_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_CREATE_MANAGER);
            })
            it("fails if poolId do not exist", async function() {
                await expect(stableCoinExtension.initializePoolToken(poolId3, paymentToken.address)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidPoolId");
            })
            it("fails if pool token is not whitelisted", async function() {
                await expect(stableCoinExtension.initializePoolToken(poolId2, poolToken.address)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidToken");
            })
            it("do not initialize if already initialized before", async function() {
                let pToken = await stableCoinExtension.getPoolToken(poolId1);
                await stableCoinExtensionOwner.updateWhitelist(poolToken.address);
                await stableCoinExtension.initializePoolToken(poolId1, poolToken.address);
                expect(await stableCoinExtension.getPoolToken(poolId1)).to.be.equal(pToken);
            })
            it("initialize otherwise", async function() {
                await stableCoinExtension.initializePoolToken(poolId2, poolToken.address);
                expect(await stableCoinExtension.getPoolToken(poolId2)).to.be.equal(poolToken.address);
            })
            it("should emit update pool token event", async function() {
                await creditPoolFacet.createCreditPool(poolId3, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE);
                await expect(stableCoinExtension.initializePoolToken(poolId3, poolToken.address))
                .to.emit(stableCoinExtension, "UpdatePoolToken")
                .withArgs(poolId3, poolToken.address);
            })
        })  
    })

    describe("Delete pool token", async function (){
        before(async function () {
            await creditPoolFacet.deleteCreditPool(poolId2);    
        })
        it("deletes pool token mapping on deleting pool", async function() {
            expect(await stableCoinExtension.getPoolToken(poolId2)).to.be.equal(zeroAddress);
        })
        it("allows to re-map token on creating a new pool with same id", async function() {
            await creditPoolFacet.createCreditPool(poolId2, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE);
            await stableCoinExtension.initializePoolToken(poolId2, paymentToken.address);
            expect(await stableCoinExtension.getPoolToken(poolId2)).to.be.equal(paymentToken.address);
        })  
    })

    describe("Update whitelisted token", async function (){
        let poolToken;
        before(async function () {
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);    
        })
        describe("when sender doesn't have ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
            })
            it("fails", async function() {
                await expect(stableCoinExtension.updateWhitelist(poolToken.address)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
        })
        describe("when sender has ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_CONFIG_MANAGER);
            })
            it("adds token to the whitelist if token is not whitelisted", async function() {
                await stableCoinExtension.updateWhitelist(poolToken.address);
                expect(await stableCoinExtension.isWhitelistedToken(poolToken.address)).to.be.equal(true);
            })
            it("removes token from the whitelist if token is whitelisted", async function() {
                await stableCoinExtension.updateWhitelist(poolToken.address);
                expect(await stableCoinExtension.isWhitelistedToken(poolToken.address)).to.be.equal(false);
            })
            it("should emit update whitelist event", async function() {
                await expect(stableCoinExtension.updateWhitelist(poolToken.address))
                .to.emit(stableCoinExtension, "UpdateWhitelist")
                .withArgs(poolToken.address, true);
            })
        })  
    })

    describe("Create credit pool and initialize pool token together", async function (){
        before(async function () {
            await creditPoolFacet.deleteCreditPool(poolId2);
            await creditPoolFacet.deleteCreditPool(poolId3);
        })
        describe("when sender doesn't have ROLE_CREATE_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, 0);
            })
            it("fails", async function() {
                await expect(stableCoinExtension.createCreditPool(poolId2, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address)).to.be.revertedWithCustomError(creditPoolFacet, "AccessDenied");
            })        
        })
        describe("when sender has ROLE_CREATE_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_CREATE_MANAGER);
                stableCoinExtension.createCreditPool(poolId2, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
            })
            it("creates a credit pool", async function() {
                expect(await creditPoolFacet.getCreditPoolStatus(poolId2)).to.be.equal(CreditPoolStatus.ACTIVE);
            })
            it("initialize a credit pool with pool token", async function() {
                expect(await stableCoinExtension.getPoolToken(poolId2)).to.be.equal(paymentToken.address);
            })
            it("should emit create credit pool event", async function() {
                await expect(stableCoinExtension.createCreditPool(poolId3, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address))
                .to.emit(stableCoinExtension, "CreateCreditPoolEvent")
                .withArgs([
                    poolId3,
                    pmId1,
                    metaHash,
                    borrowingAmount,
                    inceptionTime,
                    expiryTime,
                    curingPeriod,
                    CreditRatings.PENDING,
                    BindingIndex.POOL3,
                    CreditPoolStatus.ACTIVE
                ]);
            })
            it("should emit update pool token event", async function() {
                await creditPoolFacet.deleteCreditPool(poolId3);
                await expect(stableCoinExtension.createCreditPool(poolId3, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address))
                .to.emit(stableCoinExtension, "UpdatePoolToken")
                .withArgs(poolId3, paymentToken.address);
            })
        })  
    })

    describe("Adjust stable coin balance", async function (){
        let poolToken;
        before(async function () {
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);    
        })
        describe("when sender is not contract owner", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
            })
            it("fails", async function() {
                await expect(stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(stableCoinExtension, "NotContractOwner");
            })
        })
        describe("when sender is contract owner", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress);
            })
            it("fails if lender is not kyb verified", async function() {
                await expect(stableCoinExtension.adjustStableCoinBalance("fake", 100, poolToken.address, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(stableCoinExtension, "NotVerifiedLender");
            })
            it("fails if amount is zero", async function() {
                await expect(stableCoinExtension.adjustStableCoinBalance(id1, 0, poolToken.address, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidAmount");
            })
            it("fails if pool token is not whitelisted", async function() {
                await expect(stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidPoolToken");
            })
            it("fails if pool token is default payment token", async function() {
                await expect(stableCoinExtension.adjustStableCoinBalance(id1, 100, paymentToken.address, PaymentType.DEPOSIT)).to.be.revertedWithCustomError(stableCoinExtension, "InvalidFunction");
            })
            describe("increase stable coin balance", async function () {
                let prevBalOfLender;
                before(async function () {
                    prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                    await stableCoinExtension.updateWhitelist(poolToken.address);
                    await stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.DEPOSIT); 
                })
                it("should add payment to payment state", async function() {
                    let payment = await paymentFacet.getPayment("1");
                    assert.equal(payment.roleId, id1);
                    assert.equal(payment.creditPoolId, "");
                    assert.equal(payment.paymentType, PaymentType.DEPOSIT);
                    assert.equal(payment.from, contractOwner.address);
                    assert.equal(payment.to, diamondAddress);
                    assert.equal(payment.amount, 100);
                })
                it("should add payment id to lender state", async function() {
                    const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                    expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("1");
                })
                it("should increase lender stable coin balance", async function() {
                    expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) + 100);
                })
                it("should not affect lender vault balance", async function() {
                    expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
                })
                it("should bind stable coin with payment id", async function() {
                    expect(await stableCoinExtension.getPaymentStableCoin("1")).to.be.equal(poolToken.address);
                })
                it("should emit adjust stable coin event", async function() {
                    await expect(stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.DEPOSIT))
                    .to.emit(stableCoinExtension, "AdjustStableCoin")
                    .withArgs(id1, 100, poolToken.address, PaymentType.DEPOSIT);
                })
            })
            describe("decrease stable coin balance", async function () {
                let prevBalOfLender;
                before(async function () {
                    prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                    await stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.WITHDRAW); 
                })
                it("should add payment to payment state", async function() {
                    let payment = await paymentFacet.getPayment("3");
                    assert.equal(payment.roleId, id1);
                    assert.equal(payment.creditPoolId, "");
                    assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                    assert.equal(payment.from, diamondAddress);
                    assert.equal(payment.to, contractOwner.address);
                    assert.equal(payment.amount, 100);
                })
                it("should add payment id to lender state", async function() {
                    const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                    expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("3");
                })
                it("should decrease lender stable coin balance", async function() {
                    expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) - 100);
                })
                it("should not affect lender vault balance", async function() {
                    expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
                })
                it("should bind stable coin with payment id", async function() {
                    expect(await stableCoinExtension.getPaymentStableCoin("3")).to.be.equal(poolToken.address);
                })
                it("should emit adjust stable coin event", async function() {
                    await expect(stableCoinExtension.adjustStableCoinBalance(id1, 100, poolToken.address, PaymentType.WITHDRAW))
                    .to.emit(stableCoinExtension, "AdjustStableCoin")
                    .withArgs(id1, 100, poolToken.address, PaymentType.WITHDRAW);
                })
            })
        })  
    })

    describe("Increase stable coin balance", async function (){
        let poolToken;
        before(async function () {
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
            await poolToken.transfer(lenderWallet.address, 200);
            await poolToken.transfer(poolManagerWallet.address, 200);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, lenderWallet);
            await poolToken.approve(diamondAddress, 10000);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, poolManagerWallet);
            await poolToken.approve(diamondAddress, 10000); 
            await stableCoinExtensionOwner.updateWhitelist(poolToken.address);
        })
        describe("Deposit", async function () {
            let prevBalOfLender;
            before(async function () {
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacetExtension.deposit(id1, poolToken.address, 100);
            })
            it("should add payment to payment state", async function() {
                let payment = await paymentFacet.getPayment("5");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, "");
                assert.equal(payment.paymentType, PaymentType.DEPOSIT);
                assert.equal(payment.from, lenderWallet.address);
                assert.equal(payment.to, diamondAddress);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("5");
            })
            it("should increase lender stable coin balance", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) + 100);
            })
            it("should not affect lender vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
            })
            it("should bind stable coin with payment id", async function() {
                expect(await stableCoinExtension.getPaymentStableCoin("5")).to.be.equal(poolToken.address);
            })
            it("should emit deposit stable coin event", async function() {
                await expect(vaultFacetExtension.deposit(id1, poolToken.address, 100))
                .to.emit(vaultFacetExtension, "DepositStableCoin")
                .withArgs(id1, poolToken.address, 100);
            })
        })
        describe("Distribute", async function () {
            let prevBalOfLender, prevBalOfPool, prevPaidBalOfPool;
            before(async function () {
                await stableCoinExtensionOwner.createCreditPool(poolId4, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, poolToken.address);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacetExtension.invest(id1, poolId4, 200);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacetExtension.receiveInvestmentRequest(pmId1, poolId4, 200);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress);
                await vaultFacetExtension.processReceiveInvestmentRequest(0, true);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
                await vaultFacetExtension.pay(pmId1, poolId4, [{amount: 200, paymentType: PaymentType.PRINCIPAL}]);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress);
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                prevPaidBalOfPool = await stableCoinExtension.getPaidBalance(poolId4);
                prevBalOfPool = await vaultFacet.getVaultBalance(poolId4);
                const message = {nonce: 0, roleId: id1, poolId: poolId4, paymentInfo: [{amount: 100, paymentType: PaymentType.PRINCIPAL}],};
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
                await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
                // await vaultFacetExtension.distribute(id1, poolId4, [{amount: 100, paymentType: PaymentType.PRINCIPAL}]);
            })
            it("should add payment to payment state", async function() {
                let payment = await paymentFacet.getPayment("10");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, poolId4);
                assert.equal(payment.paymentType, PaymentType.PRINCIPAL);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("10");
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId4);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId4, Number(length) - 1)).to.be.equal("10");
            })
            it("should not remove lender id from credit pool state", async function() {
                const binding = await creditPoolFacet.getLenderBinding(id1, poolId4);
                assert.equal(binding.isBound, true);
            })
            it("should increase lender stable coin balance", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) + 100);
            })
            it("should not affect lender vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
            })
            it("should update pool paid balance", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId4)).to.be.equal(Number(prevPaidBalOfPool) - 100);
            })
            it("should not update pool vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId4)).to.be.equal(prevBalOfPool);
            })
            it("should emit distribute stable coin event", async function() {
                const message = {nonce: 1, roleId: id1, poolId: poolId4, paymentInfo: [{amount: 50, paymentType: PaymentType.PRINCIPAL}],};
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v))
                .to.emit(distributeExtension, "Distribute")
                .withArgs(id1, poolId4, []);
                // https://github.com/NomicFoundation/hardhat/issues/3833
            })
        })
        describe("Exit", async function () {
            let prevBalOfLender, prevBalOfPool, prevPaidBalOfPool;
            before(async function () {
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress);
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                prevPaidBalOfPool = await stableCoinExtension.getPaidBalance(poolId4);
                prevBalOfPool = await vaultFacet.getVaultBalance(poolId4);
            })
            it("should emit an exit event", async function() {
                const message = {nonce: 2, roleId: id1, poolId: poolId4, paymentInfo: [{amount: 50, paymentType: PaymentType.EXIT}],};
                const signature = await contractOwner._signTypedData(domainData, types, message);
                const r = signature.substring(0, 66);
                const s = "0x" + signature.substring(66, 130);
                const v = parseInt(signature.substring(130, 132), 16);
                const distributeMock = await ethers.getContractAt('DistributeMock', diamondAddress, lenderWallet);
                await expect(distributeMock.withdrawPoolPaymentIntoVault(message, r, s, v))
                .to.emit(distributeMock, "Exit")
                .withArgs(id1, poolId4, 50);
            })
            it("should add payment to payment state", async function() {
                let payment = await paymentFacet.getPayment("12");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, poolId4);
                assert.equal(payment.paymentType, PaymentType.EXIT);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 50);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("12");
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId4);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId4, Number(length) - 1)).to.be.equal("12");
            })
            it("should remove lender id from credit pool state", async function() {
                const binding = await creditPoolFacet.getLenderBinding(id1, poolId4);
                assert.equal(binding.isBound, false);
            })
            it("should increase lender stable coin balance", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) + 50);
            })
            it("should not affect lender vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
            })
            it("should update pool paid balance", async function() {
                expect(await stableCoinExtension.getPaidBalance(poolId4)).to.be.equal(Number(prevPaidBalOfPool) - 50);
            })
            it("should not update pool vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId4)).to.be.equal(prevBalOfPool);
            })
        })
    })

    describe("Decrease stable coin balance", async function (){
        let poolToken;
        before(async function () {
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
            await poolToken.transfer(lenderWallet.address, 200);
            await poolToken.transfer(poolManagerWallet.address, 200);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, lenderWallet);
            await poolToken.approve(diamondAddress, 10000);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, poolManagerWallet);
            await poolToken.approve(diamondAddress, 10000); 
            await stableCoinExtensionOwner.updateWhitelist(poolToken.address);
        })
        describe("Invest", async function () {
            let prevBalOfLender, prevVaultBalOfPool;
            before(async function () {
                await stableCoinExtensionOwner.createCreditPool(poolId5, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, poolToken.address);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacetExtension.deposit(id1, poolToken.address, 200);
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                prevVaultBalOfPool = await vaultFacet.getVaultBalance(poolId5);
                await vaultFacetExtension.invest(id1, poolId5, 100);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("14");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, poolId5);
                assert.equal(payment.paymentType, PaymentType.INVESTMENT);
                assert.equal(payment.from, lenderWallet.address);
                assert.equal(payment.to, diamondAddress);
                assert.equal(payment.amount, 100);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("14");
            })
            it("should add payment id to credit pool state", async function() {
                const length = await creditPoolFacet.getCreditPoolPaymentIdsLength(poolId5);
                expect(await creditPoolFacet.getCreditPoolPaymentId(poolId5, Number(length) - 1)).to.be.equal("14");
            })
            it("should add lender id to credit pool state", async function() {
                expect(await creditPoolFacet.getCreditPoolLenderId(poolId5, 0)).to.be.equal(id1);
            })
            it("should decrease lender stable coin balance", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) - 100);
            })
            it("should not affect lender vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
            })
            it("should update pool balance", async function() {
                expect(await vaultFacet.getVaultBalance(poolId5)).to.be.equal(Number(prevVaultBalOfPool) + 100);
            })
            it("should update pool borrowed amount", async function() {
                expect(await vaultFacet.getBorrowedAmount(poolId5)).to.be.equal(100);
            })
            it("should emit invest event", async function() {
                await stableCoinExtensionOwner.createCreditPool(poolId6, pmId1, metaHash, 100, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, poolToken.address);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                await creditPoolFacet.updateCreditPoolBorrowingAmount(poolId6, 50);
                await expect(vaultFacetExtension.invest(id1, poolId6, 50))
                .to.emit(vaultFacetExtension, "Invest")
                .withArgs(id1, poolId6, 50);
            })
            it("should process invest request with remainder borrowing amount", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) - 50);
                expect(await vaultFacet.getVaultBalance(poolId6)).to.be.equal(50);
                expect(await vaultFacet.getBorrowedAmount(poolId6)).to.be.equal(50);
            })
        })
        describe("Withdraw", async function () {
            let prevBalOfLender, prevBal;
            before(async function () {
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacetExtension.withdrawRequest(id1, poolToken.address, 25);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress);
                prevBalOfLender = await stableCoinExtension.getStableCoinBalance(id1, poolToken.address);
                prevBal = await poolToken.balanceOf(lenderWallet.address);
                await vaultFacetExtension.processWithdrawRequest(0, true);
            })
            it("should add payment to payment state", async function() {
                const payment = await paymentFacet.getPayment("16");
                assert.equal(payment.roleId, id1);
                assert.equal(payment.creditPoolId, "");
                assert.equal(payment.paymentType, PaymentType.WITHDRAW);
                assert.equal(payment.from, diamondAddress);
                assert.equal(payment.to, lenderWallet.address);
                assert.equal(payment.amount, 25);
            })
            it("should add payment id to lender state", async function() {
                const length = await lenderFacet.getLenderPaymentIdsLength(id1);
                expect(await lenderFacet.getLenderPaymentId(id1, Number(length) - 1)).to.be.equal("16");
            })
            it("should decrease lender stable coin balance", async function() {
                expect(await stableCoinExtension.getStableCoinBalance(id1, poolToken.address)).to.be.equal(Number(prevBalOfLender) - 25);
            })
            it("should transfer tokens to lender", async function() {
                expect(await poolToken.balanceOf(lenderWallet.address)).to.be.equal(Number(prevBal) + 25);
            })
            it("should not affect lender vault balance", async function() {
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(0);
            })
            it("should bind stable coin with payment id", async function() {
                expect(await stableCoinExtension.getPaymentStableCoin("16")).to.be.equal(poolToken.address);
            })
            it("should emit withdraw stable coin event", async function() {
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
                await vaultFacetExtension.withdrawRequest(id1, poolToken.address, 25);
                vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress);
                await expect(vaultFacetExtension.processWithdrawRequest(0, true))
                .to.emit(vaultFacetExtension, "WithdrawStableCoin")
                .withArgs(id1, poolToken.address, 25);
            })
        })
    })

    describe("Add stable coin withdraw request", async function (){
        let poolToken;
        before(async function () {
            const ERC20Token = await ethers.getContractFactory('ERC20Mock');
            const erc20Token = await ERC20Token.deploy();
            await erc20Token.deployed();
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address);
            await poolToken.transfer(lenderWallet.address, 200);
            await poolToken.transfer(poolManagerWallet.address, 200);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, lenderWallet);
            await poolToken.approve(diamondAddress, 10000);
            poolToken = await ethers.getContractAt('ERC20Mock', erc20Token.address, poolManagerWallet);
            await poolToken.approve(diamondAddress, 10000); 
            await stableCoinExtensionOwner.updateWhitelist(poolToken.address);
            vaultFacetExtension = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            await vaultFacetExtension.deposit(id1, poolToken.address, 200);
            await vaultFacetExtension.withdrawRequest(id1, poolToken.address, 100);    
        })
        it("should bind stable coin with request wallet", async function() {
            expect(await stableCoinExtension.getRequestedToken(id1)).to.be.equal(poolToken.address);
        })          
    })

    describe("Update threshold and cooling time", async function (){
        describe("when sender doesn't have ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, 0);
            })
            it("fails to update lender threshold", async function() {
                await expect(stableCoinExtension.updateLenderThreshold(1000)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
            it("fails to update pool threshold", async function() {
                await expect(stableCoinExtension.updatePoolThreshold(1000)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
            it("fails to update lender cooling time", async function() {
                await expect(stableCoinExtension.updateLenderCoolingTime(1000)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
            it("fails to update pool cooling time", async function() {
                await expect(stableCoinExtension.updatePoolCoolingTime(1000)).to.be.revertedWithCustomError(stableCoinExtension, "AccessDenied");
            })
        })
        describe("when sender has ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_CONFIG_MANAGER);
            })
            it("should update lender threshold", async function() {
                await stableCoinExtension.updateLenderThreshold(1000);
                await expect(stableCoinExtension.updateLenderThreshold(2000))
                .to.emit(stableCoinExtension, "UpdateLenderThreshold")
                .withArgs(1000, 2000);
                expect(await stableCoinExtension.getLenderThreshold()).to.be.equal(2000);
            })
            it("should update pool threshold", async function() {
                await stableCoinExtension.updatePoolThreshold(1000);
                await expect(stableCoinExtension.updatePoolThreshold(2000))
                .to.emit(stableCoinExtension, "UpdatePoolThreshold")
                .withArgs(1000, 2000);
                expect(await stableCoinExtension.getPoolThreshold()).to.be.equal(2000);
            })
            it("should update lender cooling time", async function() {
                await stableCoinExtension.updateLenderCoolingTime(1000);
                await expect(stableCoinExtension.updateLenderCoolingTime(2000))
                .to.emit(stableCoinExtension, "UpdateLenderCoolingTime")
                .withArgs(1000, 2000);
                expect(await stableCoinExtension.getLenderCoolingTime()).to.be.equal(2000);
            })
            it("should update pool cooling time", async function() {
                await stableCoinExtension.updatePoolCoolingTime(1000);
                await expect(stableCoinExtension.updatePoolCoolingTime(2000))
                .to.emit(stableCoinExtension, "UpdatePoolCoolingTime")
                .withArgs(1000, 2000);
                expect(await stableCoinExtension.getPoolCoolingTime()).to.be.equal(2000);
            })
        })  
    })
})