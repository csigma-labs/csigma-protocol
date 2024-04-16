/* global describe it before ethers */

const { deployDiamond } = require('../../scripts/deploy.js')
  
const { assert, expect } = require('chai')

describe('MetadataFacetTest', async function () {
  let diamondAddress
  let contractOwner
  let poolManagerWallet
  let metadataFacet
  let accessControlFacet
  let lenderWallet
  let addr1
  let addr2
  let addrs
  const metaHash = "0x"
  const baseURI = "https://csigma.finance/"
  const ROLE_CONFIG_MANAGER = 0x0008_0000
  
  before(async function () {
    diamondAddress = await deployDiamond();
    [contractOwner, poolManagerWallet, lenderWallet, addr1, addr2, ...addrs] = await ethers.getSigners();
    metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress);
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    await accessControlFacet.initializeAccessControl();
  })

  describe("Set/Update metadata base URI", async function () {
    describe("when sender doesn't have ROLE_CONFIG_MANAGER permission", async function () {
        before(async function() {
            metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress, addr1);
        })
        it("update base URI fails", async function() {
            await expect(metadataFacet.updateBaseURI(baseURI)).to.be.revertedWithCustomError(metadataFacet, "AccessDenied");
        })
    })
    describe("when sender has ROLE_CONFIG_MANAGER permission", async function () {
        before(async function() {
            metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress, addr2);
            await accessControlFacet.updateRole(addr2.address, ROLE_CONFIG_MANAGER);
        })
        it("succeed", async function() {
            await metadataFacet.updateBaseURI(baseURI);
            expect(await metadataFacet.getBaseURI()).to.be.equal(baseURI);
        })
        it("should emit update base URI event", async function() {
            await expect(metadataFacet.updateBaseURI(baseURI + "metadata/"))
                .to.emit(metadataFacet, "UpdateBaseURI")
                .withArgs(baseURI, baseURI + "metadata/");
        })
    })
  })
})