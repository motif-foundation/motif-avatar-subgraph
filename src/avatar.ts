import { Avatar } from '../types/schema'
import {
  Approval,
  ApprovalForAll,
  Avatar as AvatarContract,
  TokenMetadataURIUpdated,
  TokenURIUpdated,
  TokenDefaultUpdated,
  Transfer,
} from '../types/Avatar/Avatar'
import { log } from '@graphprotocol/graph-ts'
import {
  createAvatar,
  createTransfer,
  createURIUpdate,
  fetchAvatarBidShares,
  createDefaultUpdate,
  findOrCreateUser,
  zeroAddress,
} from './helpers'

const CONTENT = 'Content'
const METADATA = 'Metadata'

/**
 * Handler called when the `TokenURIUpdated` Event is called on the Motif Contract
 * @param event
 */
export function handleTokenURIUpdated(event: TokenURIUpdated): void {
  let tokenId = event.params._tokenId.toString()

  log.info(`Starting handler for TokenURIUpdated Event for tokenId: {}`, [tokenId])

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let updater = findOrCreateUser(event.params.owner.toHexString())
  let uriUpdateId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createURIUpdate(
    uriUpdateId,
    event.transaction.hash.toHexString(),
    avatar as Avatar,
    CONTENT,
    avatar.contentURI,
    event.params._uri,
    updater.id,
    avatar.owner,
    event.block.timestamp,
    event.block.number
  )

  avatar.contentURI = event.params._uri
  avatar.save()

  log.info(`Completed handler for TokenURIUpdated Event for tokenId: {}`, [tokenId])
}

export function handleTokenDefaultUpdated(event: TokenDefaultUpdated): void {
  let tokenId = event.params._tokenId.toString()

  log.info(`Starting handler for TokenDefaultUpdated Event for tokenId: {}`, [tokenId])

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let updater = findOrCreateUser(event.params.owner.toHexString())
  let defaultUpdateId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createDefaultUpdate(
    defaultUpdateId,
    event.transaction.hash.toHexString(),
    avatar as Avatar,
    avatar.isDefault,
    event.params._isDefault,
    updater.id,
    avatar.owner,
    event.block.timestamp,
    event.block.number
  )

  avatar.isDefault = event.params._isDefault
  avatar.save()

  log.info(`Completed handler for TokenDefaultUpdated Event for tokenId: {}`, [tokenId])
}

/**
 * Handler called when the `TokenMetadataURIUpdated` Event is called on the Motif Contract
 * @param event
 */
export function handleTokenMetadataURIUpdated(event: TokenMetadataURIUpdated): void {
  let tokenId = event.params._tokenId.toString()

  log.info(`Starting handler for TokenMetadataURIUpdated Event for tokenId: {}`, [
    tokenId,
  ])

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let updater = findOrCreateUser(event.params.owner.toHexString())
  let uriUpdateId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createURIUpdate(
    uriUpdateId,
    event.transaction.hash.toHexString(),
    avatar as Avatar,
    METADATA,
    avatar.metadataURI,
    event.params._uri,
    updater.id,
    avatar.owner,
    event.block.timestamp,
    event.block.number
  )

  avatar.metadataURI = event.params._uri
  avatar.save()

  log.info(`Completed handler for TokenMetadataURIUpdated Event for tokenId: {}`, [
    tokenId,
  ])
}

/**
 * Handler called when the `Transfer` Event is called on the Motif Contract
 * @param event
 */
export function handleTransfer(event: Transfer): void {
  let fromAddr = event.params.from.toHexString()
  let toAddr = event.params.to.toHexString()
  let tokenId = event.params.tokenId.toString()

  log.info(`Starting handler for Transfer Event of tokenId: {}, from: {}. to: {}`, [
    tokenId,
    fromAddr,
    toAddr,
  ])

  let toUser = findOrCreateUser(toAddr)
  let fromUser = findOrCreateUser(fromAddr)

  if (fromUser.id == zeroAddress) {
    handleMint(event)
    return
  }

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error(`Avatar is null for token id: {}`, [tokenId])
  }

  if (toUser.id == zeroAddress) {
    avatar.prevOwner = zeroAddress
    avatar.burnedAtTimeStamp = event.block.timestamp
    avatar.burnedAtBlockNumber = event.block.number
  }

  avatar.owner = toUser.id
  avatar.approved = null
  avatar.save()

  let transferId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createTransfer(
    transferId,
    event.transaction.hash.toHexString(),
    avatar as Avatar,
    fromUser,
    toUser,
    event.block.timestamp,
    event.block.number
  )

  log.info(`Completed handler for Transfer Event of tokenId: {}, from: {}. to: {}`, [
    tokenId,
    fromAddr,
    toAddr,
  ])
}

/**
 * Handler called when the `Approval` Event is called on the Motif Contract
 * @param event
 */
export function handleApproval(event: Approval): void {
  let ownerAddr = event.params.owner.toHexString()
  let approvedAddr = event.params.approved.toHexString()
  let tokenId = event.params.tokenId.toString()

  log.info(
    `Starting handler for Approval Event of tokenId: {}, owner: {}, approved: {}`,
    [tokenId, ownerAddr, approvedAddr]
  )

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  if (approvedAddr == zeroAddress) {
    avatar.approved = null
  } else {
    let approvedUser = findOrCreateUser(approvedAddr)
    avatar.approved = approvedUser.id
  }

  avatar.save()

  log.info(
    `Completed handler for Approval Event of tokenId: {}, owner: {}, approved: {}`,
    [tokenId, ownerAddr, approvedAddr]
  )
}

/**
 * Handler called when the `ApprovalForAll` Event is called on the Motif Contract
 * @param event
 */
export function handleApprovalForAll(event: ApprovalForAll): void {
  let ownerAddr = event.params.owner.toHexString()
  let operatorAddr = event.params.operator.toHexString()
  let approved = event.params.approved

  log.info(
    `Starting handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
    [ownerAddr, operatorAddr, approved.toString()]
  )

  let owner = findOrCreateUser(ownerAddr)
  let operator = findOrCreateUser(operatorAddr)

  if (approved == true) {
    owner.authorizedUsers = owner.authorizedUsers.concat([operator.id])
  } else {
    // if authorizedUsers array is null, no-op
    if (!owner.authorizedUsers) {
      log.info(
        'Owner does not currently have any authorized users. No db changes neccessary. Returning early.',
        []
      )
      log.info(
        `Completed handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
        [ownerAddr, operatorAddr, approved.toString()]
      )
      return
    }

    let index = owner.authorizedUsers.indexOf(operator.id)
    let copyAuthorizedUsers = owner.authorizedUsers
    copyAuthorizedUsers.splice(index, 1)
    owner.authorizedUsers = copyAuthorizedUsers
  }

  owner.save()

  log.info(
    `Completed handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
    [ownerAddr, operatorAddr, approved.toString()]
  )
}

/**
 * Handler called when the `Mint` Event is called on the Motif Contract
 * @param event
 */
function handleMint(event: Transfer): void {
  let creator = findOrCreateUser(event.params.to.toHexString())
  let zeroUser = findOrCreateUser(zeroAddress)
  let tokenId = event.params.tokenId

  let avatarContract = AvatarContract.bind(event.address)
  let contentURI = avatarContract.tokenURI(tokenId)
  let metadataURI = avatarContract.tokenMetadataURI(tokenId)

  let contentHash = avatarContract.tokenContentHashes(tokenId)
  let metadataHash = avatarContract.tokenMetadataHashes(tokenId)

  let bidShares = fetchAvatarBidShares(tokenId, event.address)

  let avatar = createAvatar(
    tokenId.toString(),
    event.transaction.hash.toHexString(),
    creator,
    creator,
    creator,
    contentURI,
    contentHash,
    metadataURI,
    metadataHash,
    bidShares.creator,
    bidShares.owner,
    bidShares.prevOwner,
    event.block.timestamp,
    event.block.number
  )

  let transferId = tokenId
    .toString()
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createTransfer(
    transferId,
    event.transaction.hash.toHexString(),
    avatar,
    zeroUser,
    creator,
    event.block.timestamp,
    event.block.number
  )
}
