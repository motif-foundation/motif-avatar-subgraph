import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts/index'
import { store, log } from '@graphprotocol/graph-ts'
import {
    Ask,
    Bid,
    Currency,
    InactiveAsk,
    InactiveBid,
    InactiveReserveListingBid,
    Avatar,
    ReserveListing,
    ReserveListingBid,
    Transfer,
    URIUpdate,
    DefaultUpdate,
    User,
} from '../types/schema'
import { Avatar as AvatarContract } from '../types/Avatar/Avatar'
import { AvatarExchange as AvatarExchangeContract } from '../types/AvatarExchange/AvatarExchange'
import { ERC20 } from '../types/AvatarExchange/ERC20'
import { ERC20NameBytes } from '../types/AvatarExchange/ERC20NameBytes'
import { ERC20SymbolBytes } from '../types/AvatarExchange/ERC20SymbolBytes'

export const zeroAddress = '0x0000000000000000000000000000000000000000'

/**
 *  helper class to model BidShares
 */
export class BidShares {
    creator: BigInt
    owner: BigInt
    prevOwner: BigInt

    constructor(creator: BigInt, owner: BigInt, prevOwner: BigInt) {
        this.creator = creator
        this.owner = owner
        this.prevOwner = prevOwner
    }
}

/**
 * Find or Create a User entity with `id` and return it
 * @param id
 */
export function findOrCreateUser(id: string): User {
    let user = User.load(id)

    if (user == null) {
        user = new User(id)
        user.save()
    }

    return user as User
}

/**
 * Find or Create a Currency entity with `id` and return it
 * @param id
 */
export function findOrCreateCurrency(id: string): Currency {
    let currency = Currency.load(id)

    if (currency == null) {
        currency = createCurrency(id)
    }

    return currency as Currency
}

/**
 * Create a Currency Entity in storage.
 * Populate fields by fetching data from the blockchain.
 * @param id
 */
export function createCurrency(id: string): Currency {
    let currency = new Currency(id)
    currency.liquidity = BigInt.fromI32(0)

    if (id === zeroAddress) {
        currency.name = 'Ethereum'
        currency.symbol = 'ETH'
        currency.decimals = 18
        currency.save()
        return currency
    }

    let name = fetchCurrencyName(Address.fromString(id))
    let symbol = fetchCurrencySymbol(Address.fromString(id))
    let decimals = fetchCurrencyDecimals(Address.fromString(id))

    currency.name = name
    currency.symbol = symbol
    currency.decimals = decimals

    currency.save()
    return currency
}

/**
 * Fetch the BidShares for a piece of Avatar by Reading the Motif AvatarExchange Contract
 * @param tokenId
 * @param avatarAddress
 */
export function fetchAvatarBidShares(tokenId: BigInt, avatarAddress: Address): BidShares {
    let avatar = AvatarContract.bind(avatarAddress)
    let avatarExchangeAddress = avatar.avatarExchangeContract()
    let avatarExchange = AvatarExchangeContract.bind(avatarExchangeAddress)
    let bidSharesTry = avatarExchange.try_bidSharesForToken(tokenId)
    if (bidSharesTry.reverted) {
        return new BidShares(null, null, null)
    }

    return new BidShares(
        bidSharesTry.value.creator.value,
        bidSharesTry.value.owner.value,
        bidSharesTry.value.prevOwner.value
    )
}

export function fetchAvatarAddress(tokenId: BigInt, avatarExchangeAddress: Address): string {
    let avatarExchange = AvatarExchangeContract.bind(avatarExchangeAddress)
    let avatarAddress = avatarExchange.avatarContract()
    return avatarAddress.toHexString()
}


/**
 * Fetch the `decimals` from the specified ERC20 contract on the blockchain
 * @param currencyAddress
 */
export function fetchCurrencyDecimals(currencyAddress: Address): i32 {
    let contract = ERC20.bind(currencyAddress)
    // try types uint8 for decimals
    let decimalValue = null
    let decimalResult = contract.try_decimals()
    if (!decimalResult.reverted) {
        decimalValue = decimalResult.value
    }
    return decimalValue as i32
}

/**
 * Fetch the `symbol` from the specified ERC20 contract on the Blockchain
 * @param currencyAddress
 */
export function fetchCurrencySymbol(currencyAddress: Address): string {
    let contract = ERC20.bind(currencyAddress)
    let contractSymbolBytes = ERC20SymbolBytes.bind(currencyAddress)

    // try types string and bytes32 for symbol
    let symbolValue = 'unknown'
    let symbolResult = contract.try_symbol()
    if (symbolResult.reverted) {
        let symbolResultBytes = contractSymbolBytes.try_symbol()
        if (!symbolResultBytes.reverted) {
            // for broken pairs that have no symbol function exposed
            if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
                symbolValue = symbolResultBytes.value.toString()
            }
        }
    } else {
        symbolValue = symbolResult.value
    }

    return symbolValue
}

/**
 * Fetch the `name` of the specified ERC20 contract on the blockchain
 * @param currencyAddress
 */
export function fetchCurrencyName(currencyAddress: Address): string {
    let contract = ERC20.bind(currencyAddress)
    let contractNameBytes = ERC20NameBytes.bind(currencyAddress)

    // try types string and bytes32 for name
    let nameValue = 'unknown'
    let nameResult = contract.try_name()
    if (nameResult.reverted) {
        let nameResultBytes = contractNameBytes.try_name()
        if (!nameResultBytes.reverted) {
            if (!isNullEthValue(nameResultBytes.value.toHexString())) {
                nameValue = nameResultBytes.value.toString()
            }
        }
    } else {
        nameValue = nameResult.value
    }

    return nameValue
}

 
/**
 * Create New Avatar Entity
 * @param id
 * @param owner
 * @param creator
 * @param prevOwner
 * @param contentURI
 * @param contentHash
 * @param metadataURI
 * @param metadataHash 
 * @param creatorBidShare
 * @param ownerBidShare
 * @param prevOwnerBidShare
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createAvatar(
    id: string, 
    transactionHash: string,
    owner: User,
    creator: User,
    prevOwner: User,
    contentURI: string,
    contentHash: Bytes,
    metadataURI: string,
    metadataHash: Bytes, 
    creatorBidShare: BigInt,
    ownerBidShare: BigInt,
    prevOwnerBidShare: BigInt,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): Avatar {

    let avatar = new Avatar(id)  
    avatar.owner = owner.id
    avatar.transactionHash = transactionHash 
    avatar.creator = creator.id
    avatar.prevOwner = prevOwner.id
    avatar.contentURI = contentURI
    avatar.contentHash = contentHash
    avatar.metadataURI = metadataURI
    avatar.metadataHash = metadataHash 
    avatar.creatorBidShare = creatorBidShare
    avatar.ownerBidShare = ownerBidShare
    avatar.prevOwnerBidShare = prevOwnerBidShare
    avatar.createdAtTimestamp = createdAtTimestamp
    avatar.createdAtBlockNumber = createdAtBlockNumber

    avatar.save()
    return avatar
}

/**
 * Create New Ask Entity
 * @param id
 * @param amount
 * @param currency
 * @param avatar
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createAsk(
    id: string,
    transactionHash: string,
    amount: BigInt,
    currency: Currency,
    avatar: Avatar,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): Ask {
    let ask = new Ask(id)
    ask.transactionHash = transactionHash
    ask.amount = amount
    ask.currency = currency.id
    ask.avatar = avatar.id
    ask.owner = avatar.owner
    ask.createdAtTimestamp = createdAtTimestamp
    ask.createdAtBlockNumber = createdAtBlockNumber

    ask.save()
    return ask
}

/**
 * Create New InactiveAsk Entity
 * @param id
 * @param avatar
 * @param type
 * @param amount
 * @param currency
 * @param owner
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createInactiveAsk(
    id: string,
    transactionHash: string,
    avatar: Avatar,
    type: string,
    amount: BigInt,
    currency: Currency,
    owner: string,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt,
    inactivatedAtTimestamp: BigInt,
    inactivatedAtBlockNumber: BigInt
): InactiveAsk {
    let inactiveAsk = new InactiveAsk(id)

    inactiveAsk.type = type
    inactiveAsk.avatar = avatar.id
    inactiveAsk.amount = amount
    inactiveAsk.currency = currency.id
    inactiveAsk.owner = owner
    inactiveAsk.createdAtTimestamp = createdAtTimestamp
    inactiveAsk.createdAtBlockNumber = createdAtBlockNumber
    inactiveAsk.inactivatedAtTimestamp = inactivatedAtTimestamp
    inactiveAsk.inactivatedAtBlockNumber = inactivatedAtBlockNumber
    inactiveAsk.transactionHash = transactionHash

    inactiveAsk.save()
    return inactiveAsk
}

/**
 * Create New InactiveBid Entity
 * @param id
 * @param type
 * @param avatar
 * @param amount
 * @param currency
 * @param sellOnShare
 * @param bidder
 * @param recipient
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createInactiveBid(
    id: string,
    transactionHash: string,
    type: string,
    avatar: Avatar,
    amount: BigInt,
    currency: Currency,
    sellOnShare: BigInt,
    bidder: User,
    recipient: User,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt,
    inactivatedAtTimestamp: BigInt,
    inactivatedAtBlockNumber: BigInt
): InactiveBid {
    let inactiveBid = new InactiveBid(id)
    inactiveBid.type = type
    inactiveBid.transactionHash = transactionHash;
    (inactiveBid.avatar = avatar.id), (inactiveBid.amount = amount)
    inactiveBid.currency = currency.id
    inactiveBid.sellOnShare = sellOnShare
    inactiveBid.bidder = bidder.id
    inactiveBid.recipient = recipient.id
    inactiveBid.createdAtTimestamp = createdAtTimestamp
    inactiveBid.createdAtBlockNumber = createdAtBlockNumber
    inactiveBid.inactivatedAtTimestamp = inactivatedAtTimestamp
    inactiveBid.inactivatedAtBlockNumber = inactivatedAtBlockNumber

    inactiveBid.save()
    return inactiveBid
}

/**
 * Create New Bid Entity
 * @param id
 * @param amount
 * @param currency
 * @param sellOnShare
 * @param bidder
 * @param recipient
 * @param avatar
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createBid(
    id: string,
    transactionHash: string,
    amount: BigInt,
    currency: Currency,
    sellOnShare: BigInt,
    bidder: User,
    recipient: User,
    avatar: Avatar,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): Bid {
    let bid = new Bid(id)
    bid.transactionHash = transactionHash
    bid.amount = amount
    bid.currency = currency.id
    bid.sellOnShare = sellOnShare
    bid.bidder = bidder.id
    bid.recipient = recipient.id
    bid.avatar = avatar.id
    bid.createdAtTimestamp = createdAtTimestamp
    bid.createdAtBlockNumber = createdAtBlockNumber

    bid.save()
    return bid
}

/**
 * Create New Transfer Entity
 * @param id
 * @param avatar
 * @param from
 * @param to
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createTransfer(
    id: string,
    transactionHash: string,
    avatar: Avatar,
    from: User,
    to: User,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): Transfer {
    let transfer = new Transfer(id)
    transfer.avatar = avatar.id
    transfer.transactionHash = transactionHash
    transfer.from = from.id
    transfer.to = to.id
    transfer.createdAtTimestamp = createdAtTimestamp
    transfer.createdAtBlockNumber = createdAtBlockNumber

    transfer.save()
    return transfer
}

/**
 * Create New URIUpdate Entity
 * @param id
 * @param avatar
 * @param type
 * @param from
 * @param to
 * @param updater
 * @param owner
 * @param createdAtTimestamp
 * @param createdAtBlockNumber
 */
export function createURIUpdate(
    id: string,
    transactionHash: string,
    avatar: Avatar,
    type: string,
    from: string,
    to: string,
    updater: string,
    owner: string,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): URIUpdate {
    let uriUpdate = new URIUpdate(id)
    uriUpdate.transactionHash = transactionHash
    uriUpdate.avatar = avatar.id
    uriUpdate.type = type
    uriUpdate.from = from
    uriUpdate.to = to
    uriUpdate.updater = updater
    uriUpdate.owner = owner
    uriUpdate.createdAtTimestamp = createdAtTimestamp
    uriUpdate.createdAtBlockNumber = createdAtBlockNumber

    uriUpdate.save()
    return uriUpdate
}

export function createDefaultUpdate(
    id: string,
    transactionHash: string,
    avatar: Avatar,
    from: boolean,
    to: boolean,
    updater: string,
    owner: string,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt
): DefaultUpdate {
    let dafaultUpdate = new DefaultUpdate(id)
    dafaultUpdate.transactionHash = transactionHash
    dafaultUpdate.avatar = avatar.id 
    dafaultUpdate.from = from
    dafaultUpdate.to = to
    dafaultUpdate.updater = updater
    dafaultUpdate.owner = owner
    dafaultUpdate.createdAtTimestamp = createdAtTimestamp
    dafaultUpdate.createdAtBlockNumber = createdAtBlockNumber

    dafaultUpdate.save()
    return dafaultUpdate
}

export function createReserveListing(
    id: string,
    transactionHash: string,
    tokenId: BigInt,
    tokenContract: string, 
    avatar: Avatar | null,
    startsAt: BigInt,
    duration: BigInt,
    listPrice: BigInt,
    listType: i32,
    intermediaryFeePercentage: i32,
    listCurrency: Currency,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt,
    tokenOwner: User,
    intermediary: User
): ReserveListing {
    let reserveListing = new ReserveListing(id)

    reserveListing.tokenId = tokenId
    reserveListing.transactionHash = transactionHash
    reserveListing.tokenContract = tokenContract 
    reserveListing.token = tokenContract.concat('-').concat(tokenId.toString())
    reserveListing.avatar = avatar ? avatar.id : null
    reserveListing.approved = false
    reserveListing.startsAt = startsAt
    reserveListing.duration = duration
    reserveListing.firstBidTime = BigInt.fromI32(0)
    reserveListing.approvedTimestamp = null
    reserveListing.listPrice = listPrice
    reserveListing.listType = listType 
    reserveListing.intermediaryFeePercentage = intermediaryFeePercentage
    reserveListing.tokenOwner = tokenOwner.id
    reserveListing.intermediary = intermediary.id
    reserveListing.listCurrency = listCurrency.id
    reserveListing.status = 'Pending'
    reserveListing.createdAtTimestamp = createdAtTimestamp
    reserveListing.createdAtBlockNumber = createdAtBlockNumber

    reserveListing.save()

    return reserveListing
}

export function setReserveListingFirstBidTime(listing: ReserveListing, time: BigInt): void {
    listing.firstBidTime = time
    listing.expectedEndTimestamp = listing.duration.plus(time)
    listing.save()
}

export function handleReserveListingExtended(listing: ReserveListing, duration: BigInt): void {
    listing.duration = duration
    listing.expectedEndTimestamp = listing.firstBidTime.plus(duration)
    listing.save()
}

export function createReserveListingBid(
    id: string,
    transactionHash: string,
    listing: ReserveListing,
    amount: BigInt,
    createdAtTimestamp: BigInt,
    createdAtBlockNumber: BigInt,
    bidder: User
): ReserveListingBid {
    let bid = new ReserveListingBid(id)

    log.warning('Creating active bid with id {}', [id])

    bid.reserveListing = listing.id
    bid.transactionHash = transactionHash
    bid.amount = amount
    bid.bidder = bidder.id
    bid.bidType = 'Active'
    bid.createdAtTimestamp = createdAtTimestamp
    bid.createdAtBlockNumber = createdAtBlockNumber

    bid.save()

    listing.currentBid = bid.id
    listing.save()

    return bid
}

// Create an inactive bid based off of the current highest bid, and delete the active bid
export function handleBidReplaced(listing: ReserveListing, timestamp: BigInt, blockNumber: BigInt, winningBid: boolean = false): void {
    let activeBid = ReserveListingBid.load(listing.currentBid) as ReserveListingBid
    let inactiveBid = new InactiveReserveListingBid(activeBid.id)

    log.info('setting reserve listing', [])
    inactiveBid.reserveListing = activeBid.reserveListing
    inactiveBid.transactionHash = activeBid.transactionHash
    log.info('setting amount: {}', [activeBid.amount.toString()])
    inactiveBid.amount = activeBid.amount
    log.info('setting bidder', [])
    inactiveBid.bidder = activeBid.bidder
    log.info('setting bid type', [])
    inactiveBid.bidType = winningBid ? 'Final' : 'Refunded'
    log.info('setting bid IAT', [])
    inactiveBid.bidInactivatedAtTimestamp = timestamp
    log.info('setting bid IABN', [])
    inactiveBid.bidInactivatedAtBlockNumber = blockNumber
    log.info('setting bid CAT', [])
    inactiveBid.createdAtTimestamp = activeBid.createdAtTimestamp
    log.info('setting bid CABN', [])
    inactiveBid.createdAtBlockNumber = activeBid.createdAtBlockNumber

    inactiveBid.save()

    store.remove('ReserveListingBid', activeBid.id)
}

export function handleFinishedListing(listing: ReserveListing, timestamp: BigInt, blockNumber: BigInt, canceledListing: boolean = false): void {
    listing.finalizedAtTimestamp = timestamp
    listing.finalizedAtBlockNumber = blockNumber
    listing.status = canceledListing ? 'Canceled' : 'Finished'
    listing.save()
}

function isNullEthValue(value: string): boolean {
    return value == '0x0000000000000000000000000000000000000000000000000000000000000001'
}