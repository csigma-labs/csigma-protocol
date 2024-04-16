/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')

const { assert, expect } = require('chai')

describe('OwnershipFacetTest', async function () {
    let diamondAddress
    let contractOwner
    let addr1
    let ownershipFacet

    before(async function () {
        diamondAddress = await deployDiamond();
        [contractOwner,addr1] = await ethers.getSigners();
        ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);
    })

    describe("View contract owner", async function (){
        it("should return contract owner address",async function(){
            const diamondOwner = await ownershipFacet.owner();
            expect(contractOwner.address).to.be.equal(diamondOwner);
        })  
    })

    describe("Transfer ownership", async function (){
        describe("when sender is not contract owner", async function () {
            before(async function() {
                ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress, addr1);
            })
            it("transfer ownership fails", async function() {
                await expect(ownershipFacet.transferOwnership(addr1.address)).to.be.revertedWithCustomError(ownershipFacet, "NotContractOwner");
            })
        })
        describe("when sender is contract owner", async function () {
            before(async function() {
                ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress, contractOwner);
            })
            it("succeed", async function() {
                await ownershipFacet.transferOwnership(addr1.address);
                let diamondOwner = await ownershipFacet.owner();
                expect(addr1.address).to.be.equal(diamondOwner);
                expect(contractOwner.address).to.be.not.equal(diamondOwner);
            })
        })
    })
})