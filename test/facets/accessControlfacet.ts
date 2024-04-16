/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')

const { assert, expect } = require('chai')

describe('AccessControlFacetTest', async function () {
    let diamondAddress
    let contractOwner
    let addr1
    let addr2
    let manager1
    let manager2
    let manager3
    let accessControlFacet
    const FULL_PRIVILEGES_MASK = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const ROLE_ACCESS_MANAGER = "57896044618658097711785492504343953926634992332820282019728792003956564819968"
    const ROLE_CREATE_MANAGER = 0x0001_0000;
    const ROLE_DELETE_MANAGER = 0x0002_0000;
    const FEATURE_CREATE = 0x0000_0001;
    const FEATURE_DELETE = 0x0000_0002;
    const FEATURE_ALL = 0x0000_0003;
    const FEATURE_ZERO = 0x0000_0000;
    const ROLE_ACCESS_TO_CREATE_MANAGER = "57896044618658097711785492504343953926634992332820282019728792003956564885504"  // (ROLE_ACCESS_MANAGER) OR (ROLE_CREATE_MANAGER)
    const ROLE_ACCESS_TO_FEATURE_DELETE = "57896044618658097711785492504343953926634992332820282019728792003956564819970"  // (ROLE_ACCESS_MANAGER) OR (FEATURE_DELETE)

    before(async function () {
        diamondAddress = await deployDiamond();
        [contractOwner, addr1, addr2, manager1, manager2, manager3] = await ethers.getSigners();
        accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
    })

    describe("Initialize access control", async function (){
        describe("when sender is not contract owner", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr1);
            })
            it("fails to initialize", async function() {
                await expect(accessControlFacet.initializeAccessControl()).to.be.revertedWithCustomError(accessControlFacet, "NotContractOwner");
            })
        })
        describe("when sender is contract owner", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
            })
            it("succeed", async function() {
                await accessControlFacet.initializeAccessControl();
                await expect(accessControlFacet.initializeAccessControl()).to.be.revertedWithCustomError(accessControlFacet, "AccessControlIsInitialized");
            })
        })
    })

    describe("Update role", async function (){
        describe("when sender doesn't have ROLE_ACCESS_MANAGER permission", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr1);
            })
            it("update role fails", async function() {
                await expect(accessControlFacet.updateRole(manager1.address, ROLE_CREATE_MANAGER)).to.be.revertedWithCustomError(accessControlFacet, "AccessDenied");
            })
        })
        describe("when sender has ROLE_ACCESS_MANAGER permission", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_MANAGER);
            })
            describe("when ACCESS_MANAGER has full set of permissions", function() {
                before(async function() {
                    await accessControlFacet.updateRole(addr2.address, FULL_PRIVILEGES_MASK);
                })
                it("what you set is what you get", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateRole(manager1.address, ROLE_CREATE_MANAGER);
                    expect(await accessControlFacet.isOperatorInRole(manager1.address, ROLE_CREATE_MANAGER)).to.be.equal(true);
                })
            })
            describe("when ACCESS_MANAGER doesn't have any permissions", function() {
                before(async function() {
                    await accessControlFacet.updateRole(contractOwner.address, FULL_PRIVILEGES_MASK);
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                    await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_MANAGER);
                })
                it("what you get, independently of what you set is always zero", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateRole(manager2.address, ROLE_CREATE_MANAGER);
                    expect(await accessControlFacet.isOperatorInRole(manager2.address, ROLE_CREATE_MANAGER)).to.be.equal(false);
                })
            })
            describe("when ACCESS_MANAGER has some permissions", function() {
                before(async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                    await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_TO_CREATE_MANAGER);
                })
                it("what you get is an intersection of what you set and what you have", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateRole(manager2.address, ROLE_CREATE_MANAGER);
                    await accessControlFacet.updateRole(manager3.address, ROLE_DELETE_MANAGER);
                    expect(await accessControlFacet.isOperatorInRole(manager2.address, ROLE_CREATE_MANAGER)).to.be.equal(true);
                    expect(await accessControlFacet.isOperatorInRole(manager3.address, ROLE_CREATE_MANAGER)).to.be.equal(false);
                    expect(await accessControlFacet.isOperatorInRole(manager3.address, ROLE_DELETE_MANAGER)).to.be.equal(false);
                })
            })
        })
    })

    describe("Update features", async function (){
        describe("when sender doesn't have ROLE_ACCESS_MANAGER permission", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr1);
            })
            it("update features fails", async function() {
                await expect(accessControlFacet.updateFeatures(FEATURE_CREATE)).to.be.revertedWithCustomError(accessControlFacet, "AccessDenied");
            })
        })
        describe("when sender has ROLE_ACCESS_MANAGER permission", async function () {
            before(async function() {
                accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_MANAGER);
            })
            describe("when ACCESS_MANAGER has full set of permissions", function() {
                before(async function() {
                    await accessControlFacet.updateRole(addr2.address, FULL_PRIVILEGES_MASK);
                })
                it("what you set is what you get", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateFeatures(FEATURE_CREATE);
                    expect(await accessControlFacet.isFeatureEnabled(FEATURE_CREATE)).to.be.equal(true);
                })
            })
            describe("when ACCESS_MANAGER doesn't have any permissions", function() {
                before(async function() {
                    await accessControlFacet.updateRole(contractOwner.address, FULL_PRIVILEGES_MASK);
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                    await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_MANAGER);
                })
                it("what you get, independently of what you set is always zero", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateFeatures(FEATURE_DELETE);
                    expect(await accessControlFacet.isFeatureEnabled(FEATURE_DELETE)).to.be.equal(false);
                })
            })
            describe("when ACCESS_MANAGER has some permissions", function() {
                before(async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);
                    await accessControlFacet.updateRole(addr2.address, ROLE_ACCESS_TO_FEATURE_DELETE);
                })
                it("what you get is an intersection of what you set and what you have", async function() {
                    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr2);
                    await accessControlFacet.updateFeatures(FEATURE_DELETE);
                    expect(await accessControlFacet.isFeatureEnabled(FEATURE_DELETE)).to.be.equal(true);
                })
            })
        })
    })

    describe("Check role", async function (){
        before(async function() {
            accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);    
            await accessControlFacet.updateRole(addr1.address, ROLE_ACCESS_MANAGER);
            accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, addr1);
        })
        it("should return true if operator has given role",async function(){
            expect(await accessControlFacet.isOperatorInRole(addr1.address, ROLE_ACCESS_MANAGER)).to.be.equal(true);
        })
        it("should return false if operator hasn't given role",async function(){
            expect(await accessControlFacet.isOperatorInRole(addr1.address, ROLE_CREATE_MANAGER)).to.be.equal(false);
        })
        it("should return true if sender has given role",async function(){
            expect(await accessControlFacet.isSenderInRole(ROLE_ACCESS_MANAGER)).to.be.equal(true);
        })
        it("should return false if sender hasn't given role",async function(){
            expect(await accessControlFacet.isSenderInRole(ROLE_CREATE_MANAGER)).to.be.equal(false);
        })  
    })

    describe("Check features", async function (){
        before(async function() {
            accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress, contractOwner);    
            await accessControlFacet.updateFeatures(FEATURE_ALL);
        })
        it("should return features that contract has",async function(){
            expect(await accessControlFacet.features()).to.be.equal(FEATURE_ALL);
        })
        it("should return true if feature is enabled",async function(){
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_ALL)).to.be.equal(true);
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_CREATE)).to.be.equal(true);
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_DELETE)).to.be.equal(true);
        })
        it("should return false if feature is not enabled",async function(){
            await accessControlFacet.updateFeatures(FEATURE_ZERO);
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_ALL)).to.be.equal(false);
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_CREATE)).to.be.equal(false);
            expect(await accessControlFacet.isFeatureEnabled(FEATURE_DELETE)).to.be.equal(false);
        })  
    })
})