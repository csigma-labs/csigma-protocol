/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')

const { assert, expect } = require('chai')

describe('DistributeExtensionTest', async function () {
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
    const ROLE_DISTRIBUTE_MANAGER = 0x0040_0000;
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
        await stableCoinExtension.createCreditPool(poolId1, pmId1, metaHash, borrowingAmount, inceptionTime, expiryTime, curingPeriod, CreditPoolStatus.ACTIVE, paymentToken.address);
        await lenderFacet.createLender(id1, userId1, metaHash, country, onBoardTime, lenderWallet.address, KYBStatus.VERIFIED);
        const chainId = await paymentToken.getChainId();
        domainData = {
            name: "cSigmaDiamond",
            version: "1",
            chainId: Number(chainId),
            verifyingContract: diamondAddress,
        };
    })

    describe("Set domain seperator", async function (){
        describe("when sender doesn't have ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, addr2);
            })
            it("fails", async function() {
                await expect(distributeExtension.setDomainSeperator()).to.be.revertedWithCustomError(distributeExtension, "AccessDenied");
            })
        })
        describe("when sender has ROLE_CONFIG_MANAGER permission", async function (){
            before(async function () {
                distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, addr2);
                await accessControlFacet.updateRole(addr2.address, ROLE_CONFIG_MANAGER);
            })
            it("should set domain seperator", async function() {
                const prevDomainSeperator = await distributeExtension.getDomainSeperator();
                await distributeExtension.setDomainSeperator();
                expect(await distributeExtension.getDomainSeperator()).not.to.be.equal(prevDomainSeperator);
            })
        })  
    })

    describe("Withdraw pool payment using EIP 712 signature", async function (){
        before(async function () {
            await paymentToken.transfer(lenderWallet.address, 1000);
            await paymentToken.transfer(poolManagerWallet.address, 1000);
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, lenderWallet);
            paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, lenderWallet);
            await paymentToken.approve(diamondAddress, 1000);
            await vaultFacet.deposit(id1, paymentToken.address, 1000);
            await vaultFacet.invest(id1, poolId1, 1000);
            vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress, poolManagerWallet);
            paymentToken = await ethers.getContractAt('ERC20Mock', paymentToken.address, poolManagerWallet);
            await paymentToken.approve(diamondAddress, 1000);
            await vaultFacet.pay(pmId1, poolId1, [{amount: 1000, paymentType: PaymentType.PRINCIPAL}]);
        })
        describe("when signer doesn't have ROLE_DISTRIBUTE_MANAGER permission", async function (){
            let message, r, s, v;
            before(async function () {
                distributeExtension = await ethers.getContractAt('DistributeFacet', diamondAddress, lenderWallet);
                message = {nonce: 0, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await lenderWallet._signTypedData(domainData, types, message);
                r = signature.substring(0, 66);
                s = "0x" + signature.substring(66, 130);
                v = parseInt(signature.substring(130, 132), 16);
            })
            it("fails", async function() {
                await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "InvalidSigner");
            })
        })
        describe("when signer has ROLE_DISTRIBUTE_MANAGER permission", async function (){
            let message, r, s, v;
            before(async function () {
                await accessControlFacet.updateRole(addr2.address, ROLE_DISTRIBUTE_MANAGER);
                message = {nonce: 0, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                r = signature.substring(0, 66);
                s = "0x" + signature.substring(66, 130);
                v = parseInt(signature.substring(130, 132), 16);
                await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
            })
            it("fails if nonce used before", async function() {
                await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v)).to.be.revertedWithCustomError(distributeExtension, "NonceUsed");    
            })
            it("succeed otherwise", async function() {
                const prevBal = await vaultFacet.getVaultBalance(id1);
                message = {nonce: 1, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                r = signature.substring(0, 66);
                s = "0x" + signature.substring(66, 130);
                v = parseInt(signature.substring(130, 132), 16);
                await distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v);
                expect(await vaultFacet.getVaultBalance(id1)).to.be.equal(Number(prevBal) + 10);               
            })
            it("should allow to withdraw pool payment into wallet", async function() {
                const prevBal = await paymentToken.balanceOf(lenderWallet.address);
                await stableCoinExtension.updateLenderThreshold(100);
                message = {nonce: 2, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                r = signature.substring(0, 66);
                s = "0x" + signature.substring(66, 130);
                v = parseInt(signature.substring(130, 132), 16);
                await distributeExtension.withdrawPoolPaymentIntoWallet(message, r, s, v, paymentToken.address, 10);
                expect(await paymentToken.balanceOf(lenderWallet.address)).to.be.equal(Number(prevBal) + 10);               
            })
            it("should emit authorization used event", async function() {
                await stableCoinExtension.updateLenderThreshold(100);
                message = {nonce: 3, roleId: id1, poolId: poolId1, paymentInfo: [{amount: 10, paymentType: PaymentType.COUPON}],};
                const signature = await addr2._signTypedData(domainData, types, message);
                r = signature.substring(0, 66);
                s = "0x" + signature.substring(66, 130);
                v = parseInt(signature.substring(130, 132), 16);
                distributeExtension = await ethers.getContractAt('DistributeMock', diamondAddress, lenderWallet);
                await expect(distributeExtension.withdrawPoolPaymentIntoVault(message, r, s, v))
                .to.emit(distributeExtension, "AuthorizationUsed")
                .withArgs(addr2.address, []);
                // https://github.com/NomicFoundation/hardhat/issues/3833
            })
        })  
    })
})