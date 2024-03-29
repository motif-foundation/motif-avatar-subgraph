import {
  AskCreated,
  AskRemoved,
  BidCreated,
  BidFinalized,
  BidRemoved,
  BidShareUpdated,
} from '../types/AvatarExchange/AvatarExchange'
import { BigInt, log, store } from '@graphprotocol/graph-ts'
import { Ask, Bid, Avatar, Transfer } from '../types/schema'
import {
  createAsk,
  createBid,
  createInactiveAsk,
  createInactiveBid,
  findOrCreateCurrency,
  findOrCreateUser,
  zeroAddress,
} from './helpers'

const REMOVED = 'Removed'
const FINALIZED = 'Finalized'

/**
 * Handler called when a `BidShareUpdated` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleBidShareUpdated(event: BidShareUpdated): void {
  let tokenId = event.params.tokenId.toString()
  let bidShares = event.params.bidShares

  log.info(`Starting handler for BidShareUpdated Event for tokenId: {}, bidShares: {}`, [
    tokenId,
    bidShares.toString(),
  ])

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  avatar.creatorBidShare = bidShares.creator.value
  avatar.ownerBidShare = bidShares.owner.value
  avatar.prevOwnerBidShare = bidShares.prevOwner.value
  avatar.save()

  log.info(`Completed handler for BidShareUpdated Event for tokenId: {}, bidShares: {}`, [
    tokenId,
    bidShares.toString(),
  ])
}

/**
 * Handler called when the `AskCreated` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleAskCreated(event: AskCreated): void {
  let tokenId = event.params.tokenId.toString()
  let onchainAsk = event.params.ask

  log.info(`Starting handler for AskCreated Event for tokenId: {}, ask: {}`, [
    tokenId,
    onchainAsk.toString(),
  ])

  let avatar = Avatar.load(tokenId)
  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let currency = findOrCreateCurrency(onchainAsk.currency.toHexString())
  let askId = avatar.id.concat('-').concat(avatar.owner)
  let ask = Ask.load(askId)

  if (ask == null) {
    createAsk(
      askId,
      event.transaction.hash.toHexString(),
      onchainAsk.amount,
      currency,
      avatar as Avatar,
      event.block.timestamp,
      event.block.number
    )
  } else {
    let inactiveAskId = tokenId
      .concat('-')
      .concat(event.transaction.hash.toHexString())
      .concat('-')
      .concat(event.transactionLogIndex.toString())

    // create an inactive ask
    createInactiveAsk(
      inactiveAskId,
      event.transaction.hash.toHexString(),
      avatar as Avatar,
      REMOVED,
      ask.amount,
      currency,
      ask.owner,
      ask.createdAtTimestamp,
      ask.createdAtBlockNumber,
      event.block.timestamp,
      event.block.number
    )

    // update the fields on the original ask object
    ask.amount = onchainAsk.amount
    ask.currency = currency.id
    ask.createdAtTimestamp = event.block.timestamp
    ask.createdAtBlockNumber = event.block.number
    ask.save()
  }

  log.info(`Completed handler for AskCreated Event for tokenId: {}, ask: {}`, [
    tokenId,
    onchainAsk.toString(),
  ])
}

/**
 * Handler called when the `AskRemoved` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleAskRemoved(event: AskRemoved): void {
  let tokenId = event.params.tokenId.toString()
  let onChainAsk = event.params.ask
  let askId: string

  log.info(`Starting handler for AskRemoved Event for tokenId: {}`, [tokenId])

  let zero = BigInt.fromI32(0)
  // asks must be > 0 and evenly split by bidshares
  if (onChainAsk.amount.equals(zero)) {
    log.info(
      `AskRemoved Event has a 0 amount, returning early and not updating state`,
      []
    )
    askId = zeroAddress
  } else {
    let avatar = Avatar.load(tokenId)
    if (avatar == null) {
      log.error('Avatar is null for tokenId: {}', [tokenId])
    }

    let currency = findOrCreateCurrency(onChainAsk.currency.toHexString())

    askId = tokenId.concat('-').concat(avatar.owner)
    let ask = Ask.load(askId)
    if (ask == null) {
      log.error('Ask is null for askId: {}', [askId])
    }

    let inactiveAskId = tokenId
      .concat('-')
      .concat(event.transaction.hash.toHexString())
      .concat('-')
      .concat(event.transactionLogIndex.toString())

    createInactiveAsk(
      inactiveAskId,
      event.transaction.hash.toHexString(),
      avatar as Avatar,
      REMOVED,
      ask.amount,
      currency,
      ask.owner,
      ask.createdAtTimestamp,
      ask.createdAtBlockNumber,
      event.block.timestamp,
      event.block.number
    )

    store.remove('Ask', askId)
  }

  log.info(`Completed handler for AskRemoved Event for tokenId: {}, askId: {}`, [
    tokenId,
    askId,
  ])
}

/**
 * Handler called `BidCreated` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleBidCreated(event: BidCreated): void {
  let tokenId = event.params.tokenId.toString()
  let avatar = Avatar.load(tokenId)
  let bid = event.params.bid

  log.info(`Starting handler for BidCreated Event for tokenId: {}, bid: {}`, [
    tokenId,
    bid.toString(),
  ])

  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let bidId = avatar.id.concat('-').concat(bid.bidder.toHexString())

  let bidder = findOrCreateUser(bid.bidder.toHexString())
  let recipient = findOrCreateUser(bid.recipient.toHexString())

  let currency = findOrCreateCurrency(bid.currency.toHexString())

  createBid(
    bidId,
    event.transaction.hash.toHexString(),
    bid.amount,
    currency,
    bid.sellOnShare.value,
    bidder,
    recipient,
    avatar as Avatar,
    event.block.timestamp,
    event.block.number
  )

  // Update Currency Liquidity
  currency.liquidity = currency.liquidity.plus(bid.amount)
  currency.save()

  log.info(`Completed handler for BidCreated Event for tokenId: {}, bid: {}`, [
    tokenId,
    bid.toString(),
  ])
}

/**
 * Handler called when the `BidRemoved` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleBidRemoved(event: BidRemoved): void {
  let tokenId = event.params.tokenId.toString()
  let avatar = Avatar.load(tokenId)
  let onChainBid = event.params.bid

  let bidId = tokenId.concat('-').concat(onChainBid.bidder.toHexString())

  log.info(`Starting handler for BidRemoved Event for tokenId: {}, bid: {}`, [
    tokenId,
    bidId,
  ])

  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  let bid = Bid.load(bidId)
  if (bid == null) {
    log.error('Bid is null for bidId: {}', [bidId])
  }

  let inactiveBidId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())
  let bidder = findOrCreateUser(onChainBid.bidder.toHexString())
  let recipient = findOrCreateUser(onChainBid.recipient.toHexString())
  let currency = findOrCreateCurrency(onChainBid.currency.toHexString())

  // Create Inactive Bid
  createInactiveBid(
    inactiveBidId,
    event.transaction.hash.toHexString(),
    REMOVED,
    avatar as Avatar,
    onChainBid.amount,
    currency,
    onChainBid.sellOnShare.value,
    bidder,
    recipient,
    bid.createdAtTimestamp,
    bid.createdAtBlockNumber,
    event.block.timestamp,
    event.block.number
  )

  // Update Currency Liquidity
  currency.liquidity = currency.liquidity.minus(bid.amount)
  currency.save()

  // Remove Bid
  store.remove('Bid', bidId)
  log.info(`Completed handler for BidRemoved Event for tokenId: {}, bid: {}`, [
    tokenId,
    bidId,
  ])
}

/**
 * Handler called when the `BidFinalized` Event is emitted on the Motif AvatarExchange Contract
 * @param event
 */
export function handleBidFinalized(event: BidFinalized): void {
  let tokenId = event.params.tokenId.toString()
  let avatar = Avatar.load(tokenId)
  let onChainBid = event.params.bid

  let bidId = tokenId.concat('-').concat(onChainBid.bidder.toHexString())
  log.info(`Starting handler for BidFinalized Event for tokenId: {}, bid: {}`, [
    tokenId,
    bidId,
  ])

  if (avatar == null) {
    log.error('Avatar is null for tokenId: {}', [tokenId])
  }

  // let bid = Bid.load(bidId)
  // if (bid == null) {
  //   log.error('Bid is null for bidId: {}', [bidId])
  // }

  let inactiveBidId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  let bidder = findOrCreateUser(onChainBid.bidder.toHexString())
  let recipient = findOrCreateUser(onChainBid.recipient.toHexString())
  let currency = findOrCreateCurrency(onChainBid.currency.toHexString())

  // BidFinalized is always **two** events after transfer
  // https://github.com/ourzora/core/blob/master/contracts/AvatarExchange.sol#L349
  // Find the transfer by id and set the from address as the prevOwner of the avatar
  let transferId = event.params.tokenId
    .toString()
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.minus(BigInt.fromI32(2)).toString())
  let transfer = Transfer.load(transferId)
  if (transfer == null) {
    log.error('Transfer is null for transfer id: {}', [transferId])
  }

  avatar.prevOwner = transfer.from
  avatar.save()

  // Create Inactive Bid
  createInactiveBid(
    inactiveBidId,
    event.transaction.hash.toHexString(),
    FINALIZED,
    avatar as Avatar,
    onChainBid.amount,
    currency,
    onChainBid.sellOnShare.value,
    bidder,
    recipient,
    event.block.timestamp, //onChainBid.createdAtTimestamp,
    event.block.number,//onChainBid.createdAtBlockNumber,
    event.block.timestamp,
    event.block.number
  )

  // Update Currency Liquidity
  currency.liquidity = currency.liquidity.minus(onChainBid.amount)// bid.amount
  currency.save()

  // Remove Bid
  store.remove('Bid', bidId)
  log.info(`Completed handler for BidFinalized Event for tokenId: {}, bid: {}`, [
    tokenId,
    bidId,
  ])
}
