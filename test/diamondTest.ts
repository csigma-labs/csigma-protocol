/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')

const { deployDiamond } = require('../scripts/deploy.js')

const { assert } = require('chai')

describe('DiamondTest', async function () {
  let diamondAddress
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  let poolManagerFacet
  let lenderFacet
  let creditPoolFacet
  let paymentFacet
  let vaultFacet
  let distributeFacet
  let metadataFacet
  let accessControlFacet
  let stableCoinExtension
  let tx
  let receipt
  let result
  const addresses = []

  before(async function () {
    diamondAddress = await deployDiamond()
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    poolManagerFacet = await ethers.getContractAt('PoolManagerFacet', diamondAddress)
    lenderFacet = await ethers.getContractAt('LenderFacet', diamondAddress)
    creditPoolFacet = await ethers.getContractAt('CreditPoolFacet', diamondAddress)
    paymentFacet = await ethers.getContractAt('PaymentFacet', diamondAddress)
    vaultFacet = await ethers.getContractAt('VaultFacet', diamondAddress)
    distributeFacet = await ethers.getContractAt('DistributeFacet', diamondAddress)
    metadataFacet = await ethers.getContractAt('MetadataFacet', diamondAddress)
    accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress)
    stableCoinExtension = await ethers.getContractAt('StableCoinExtension', diamondAddress)
  })

  it('should have three facets -- call to facetAddresses function', async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)
    }

    assert.equal(addresses.length, 12)
  })

  it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    let selectors = getSelectors(diamondCutFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(ownershipFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(poolManagerFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(lenderFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(creditPoolFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[5])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(paymentFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[6])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(vaultFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[7])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(metadataFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[8])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(accessControlFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[9])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(distributeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[10])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(stableCoinExtension)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[11])
    assert.sameMembers(result, selectors)
  })

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    assert.equal(
      addresses[0],
      await diamondLoupeFacet.facetAddress('0x1f931c1c')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0x01ffc9a7')
    )
    assert.equal(
      addresses[2],
      await diamondLoupeFacet.facetAddress('0xf2fde38b')
    )
    assert.equal(
      addresses[3],
      await diamondLoupeFacet.facetAddress('0x77bcd0a2')
    )
    assert.equal(
      addresses[4],
      await diamondLoupeFacet.facetAddress('0xc3f5a195')
    )
    assert.equal(
      addresses[5],
      await diamondLoupeFacet.facetAddress('0x4bf28cb3')
    )
    assert.equal(
      addresses[6],
      await diamondLoupeFacet.facetAddress('0xc69207a3')
    )
    assert.equal(
      addresses[7],
      await diamondLoupeFacet.facetAddress('0x583e9318')
    )
    assert.equal(
      addresses[8],
      await diamondLoupeFacet.facetAddress('0x714c5398')
    )
    assert.equal(
      addresses[9],
      await diamondLoupeFacet.facetAddress('0x2b521416')
    )
    assert.equal(
      addresses[10],
      await diamondLoupeFacet.facetAddress('0x20379ee5')
    )
    assert.equal(
      addresses[11],
      await diamondLoupeFacet.facetAddress('0x7bcb9896')
    )
  })

  it('should add test1 functions', async () => {
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const test1Facet = await Test1Facet.deploy()
    await test1Facet.deployed()
    addresses.push(test1Facet.address)
    const selectors = getSelectors(test1Facet).remove(['supportsInterface(bytes4)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: test1Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address)
    assert.sameMembers(result, selectors)
  })

  it('should test function call', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    await test1Facet.test1Func10()
  })

  it('should replace supportsInterface function', async () => {
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
    const testFacetAddress = addresses[12]
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: testFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
    assert.sameMembers(result, getSelectors(Test1Facet))
  })

  it('should add test2 functions', async () => {
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    const test2Facet = await Test2Facet.deploy()
    await test2Facet.deployed()
    addresses.push(test2Facet.address)
    const selectors = getSelectors(test2Facet)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: test2Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
    assert.sameMembers(result, selectors)
  })

  it('should remove some test2 functions', async () => {
    const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
    const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
    const selectors = getSelectors(test2Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[13])
    assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
  })

  it('should remove some test1 functions', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
    const selectors = getSelectors(test1Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[12])
    assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
  })

  it('remove all functions and facets accept \'diamondCut\' and \'facets\'', async () => {
    let selectors = []
    let facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length / 3; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 850000 })
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    selectors = []
    facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length / 2; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 850000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    selectors = []
    facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 850000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    facets = await diamondLoupeFacet.facets()
    assert.equal(facets.length, 2)
    assert.equal(facets[0][0], addresses[0])
    assert.sameMembers(facets[0][1], ['0x1f931c1c'])
    assert.equal(facets[1][0], addresses[1])
    assert.sameMembers(facets[1][1], ['0x7a0ed627'])
  })

  it('add most functions and facets', async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet)
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(poolManagerFacet)
      },
      {
        facetAddress: addresses[4],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(lenderFacet)
      },
      {
        facetAddress: addresses[5],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(creditPoolFacet)
      },
      {
        facetAddress: addresses[6],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(paymentFacet)
      },
      {
        facetAddress: addresses[7],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(vaultFacet)
      },
      {
        facetAddress: addresses[8],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(metadataFacet)
      },
      {
        facetAddress: addresses[9],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(accessControlFacet)
      },
      {
        facetAddress: addresses[10],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(distributeFacet)
      },
      {
        facetAddress: addresses[11],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(stableCoinExtension)
      },
      {
        facetAddress: addresses[12],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test1Facet)
      },
      {
        facetAddress: addresses[13],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test2Facet)
      }
    ]
    tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x', { gasLimit: 8000000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    const facets = await diamondLoupeFacet.facets()
    const facetAddresses = await diamondLoupeFacet.facetAddresses()
    assert.equal(facetAddresses.length, 14)
    assert.equal(facets.length, 14)
    assert.sameMembers(facetAddresses, addresses)
    assert.equal(facets[0][0], facetAddresses[0], 'first facet')
    assert.equal(facets[1][0], facetAddresses[1], 'second facet')
    assert.equal(facets[2][0], facetAddresses[2], 'third facet')
    assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
    assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
    assert.equal(facets[5][0], facetAddresses[5], 'sixth facet')
    assert.equal(facets[6][0], facetAddresses[6], 'seventh facet')
    assert.equal(facets[7][0], facetAddresses[7], 'eighth facet')
    assert.equal(facets[8][0], facetAddresses[8], 'ninth facet')
    assert.equal(facets[9][0], facetAddresses[9], 'tenth facet')
    assert.equal(facets[10][0], facetAddresses[10], 'eleventh facet')
    assert.equal(facets[11][0], facetAddresses[11], 'twelveth facet')
    assert.equal(facets[12][0], facetAddresses[12], 'thirteenth facet')
    assert.equal(facets[13][0], facetAddresses[13], 'fourteenth facet')
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(poolManagerFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(lenderFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[5], facets)][1], getSelectors(creditPoolFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[6], facets)][1], getSelectors(paymentFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[7], facets)][1], getSelectors(vaultFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[8], facets)][1], getSelectors(metadataFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[9], facets)][1], getSelectors(accessControlFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[10], facets)][1], getSelectors(distributeFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[11], facets)][1], getSelectors(stableCoinExtension))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[12], facets)][1], getSelectors(Test1Facet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[13], facets)][1], getSelectors(Test2Facet))
  })
})
