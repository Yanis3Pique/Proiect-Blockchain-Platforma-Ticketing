// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importuri necesare
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract EventContract is ERC721, Ownable, ReentrancyGuard {
    // Structura pentru un bilet
    struct Ticket {
        uint256 ticketId;
        address owner;
        bool isValid;
    }

    // Detalii despre eveniment
    uint256 public eventId;
    string public eventName;
    string public eventLocation;
    uint256 public eventDate;
    uint256 public ticketPriceUSD; // Pretul biletului in USD
    uint256 public ticketsAvailable;
    address payable public organizer;
    uint256 public nextTicketId;
    bool public isCancelled;
    address payable public platform;

    // Mapping pentru bilete
    mapping(uint256 => Ticket) public tickets;

    // Mapping to keep track of ticket price paid per ticket ID
    mapping(uint256 => uint256) public ticketPricesPaid;

    // Mapping for withdrawal amounts
    mapping(address => uint256) public pendingWithdrawals;

    // Chainlink Price Feed
    AggregatorV3Interface internal priceFeed;

    // Evenimente
    event TicketPurchased(uint256 indexed ticketId, address indexed buyer);
    event TicketTransferred(
        uint256 indexed ticketId,
        address indexed from,
        address indexed to
    );
    event EventCancelled();
    event TicketRefunded(
        uint256 indexed ticketId,
        address indexed owner,
        uint256 refundAmount
    );
    event TicketInvalidated(uint256 indexed ticketId);

    // Modificatori
    modifier onlyOrganizer() {
        require(
            msg.sender == organizer,
            "Doar organizatorul poate apela aceasta functie."
        );
        _;
    }

    // Modifier to check if the event is not cancelled
    modifier eventNotCancelled() {
        require(!isCancelled, "Event is cancelled.");
        _;
    }

    constructor(
        uint256 _eventId,
        string memory _eventName,
        string memory _eventLocation,
        uint256 _eventDate,
        uint256 _ticketPriceUSD, // Pretul biletului în USD
        uint256 _ticketsAvailable,
        address payable _organizer,
        address _priceFeedAddress, // Adresa Price Feed-ului Chainlink
        address payable _platform
    ) ERC721(_eventName, "TKT") Ownable(msg.sender) {
        eventId = _eventId;
        eventName = _eventName;
        eventLocation = _eventLocation;
        eventDate = _eventDate;
        ticketPriceUSD = _ticketPriceUSD;
        ticketsAvailable = _ticketsAvailable;
        organizer = _organizer;
        nextTicketId = 1;
        isCancelled = false;
        platform = _platform;

        // Initializarea Chainlink Price Feed
        priceFeed = AggregatorV3Interface(_priceFeedAddress);

        // Transfer ownership to the organizer
        transferOwnership(_organizer);
    }

    // Function to get the latest ETH/USD price from Chainlink
    function getLatestPrice() internal view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid ETH price.");
        return uint256(price); // Price in USD with 8 decimals
    }

    // Functie pentru a calcula pretul biletului in Wei
    function getTicketPriceInWei() public view returns (uint256) {
        uint256 ethPrice = getLatestPrice(); // Pretul ETH in USD cu 8 zecimale
        require(ethPrice > 0, "Pretul ETH nu este valid.");

        uint256 priceInWei = (ticketPriceUSD * 1e26) / uint256(ethPrice); // Calculam pretul biletului in Wei

        // output the price in Wei for test
        console.log("Price in Wei: %s", priceInWei);

        return priceInWei;
    }

    function buyTickets(uint256 _quantity) public payable eventNotCancelled {
        require(_quantity > 0, "Must buy at least one ticket.");
        require(ticketsAvailable >= _quantity, "Not enough tickets available.");
        require(
            block.timestamp < eventDate,
            "Cannot purchase tickets after event date."
        );

        uint256 ticketPriceInWei = getTicketPriceInWei();

        // Total price for tickets without service fee
        uint256 totalTicketPrice = ticketPriceInWei * _quantity;

        // Calculate the total service fee
        uint256 totalServiceFee = calculateServiceFee(totalTicketPrice);

        uint256 totalPriceWithFee = totalTicketPrice + totalServiceFee;

        require(
            msg.value >= totalPriceWithFee,
            "Insufficient funds to purchase tickets."
        );

        ticketsAvailable -= _quantity;

        // Transfer the service fee to the platform
        (bool feeTransferSuccess, ) = platform.call{value: totalServiceFee}("");
        require(feeTransferSuccess, "Service fee transfer failed.");

        // Funds for tickets remain in the contract for refund purposes
        // No need to add to pendingWithdrawals; funds stay in contract balance

        // Mint tickets and create Ticket instances
        for (uint256 i = 0; i < _quantity; i++) {
            uint256 ticketId = nextTicketId;
            _safeMint(msg.sender, ticketId);

            tickets[ticketId] = Ticket({
                ticketId: ticketId,
                owner: msg.sender,
                isValid: true
            });

            // Record only the ticket price paid, excluding the service fee
            ticketPricesPaid[ticketId] = ticketPriceInWei;

            emit TicketPurchased(ticketId, msg.sender);

            nextTicketId++;
        }

        // Refund any excess payment
        uint256 excessPayment = msg.value - totalPriceWithFee;
        if (excessPayment > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excessPayment}("");
            require(refundSuccess, "Refund of excess payment failed.");
        }
    }

    function transferTicket(
        uint256 _ticketId,
        address _to
    ) public eventNotCancelled {
        require(
            ownerOf(_ticketId) == msg.sender,
            "You do not own this ticket."
        );
        require(
            block.timestamp < eventDate,
            "Cannot transfer tickets after the event date."
        );

        _transfer(msg.sender, _to, _ticketId);
        tickets[_ticketId].owner = _to;

        emit TicketTransferred(_ticketId, msg.sender, _to);
    }

    function transferTickets(
        uint256[] memory _ticketIds,
        address _to
    ) public eventNotCancelled {
        for (uint256 i = 0; i < _ticketIds.length; i++) {
            uint256 ticketId = _ticketIds[i];
            if (ownerOf(ticketId) == msg.sender && tickets[ticketId].isValid) {
                _transfer(msg.sender, _to, ticketId);
                tickets[ticketId].owner = _to;

                emit TicketTransferred(ticketId, msg.sender, _to);
            }
        }
    }

    function invalidateTicket(uint256 _ticketId) public onlyOrganizer {
        require(tickets[_ticketId].isValid, "Ticket is already invalid.");
        _burn(_ticketId);
        tickets[_ticketId].isValid = false;

        emit TicketInvalidated(_ticketId);
    }

    function invalidateTickets(
        uint256[] memory _ticketIds
    ) public onlyOrganizer {
        for (uint256 i = 0; i < _ticketIds.length; i++) {
            uint256 ticketId = _ticketIds[i];
            if (tickets[ticketId].isValid) {
                _burn(ticketId);
                tickets[ticketId].isValid = false;

                emit TicketInvalidated(ticketId);
            }
        }
    }

    // Function to cancel the event
    function cancelEvent() public onlyOwner nonReentrant {
        require(!isCancelled, "Event is already cancelled.");
        isCancelled = true;

        // Refund all ticket owners and burn tickets
        refundAllTickets();

        emit EventCancelled();
    }

    function refundAllTickets() private {
        for (uint256 i = 1; i < nextTicketId; i++) {
            if (tickets[i].isValid) {
                address payable ticketOwner = payable(tickets[i].owner);
                uint256 refundAmount = ticketPricesPaid[i];

                // Invalidate the ticket and burn it
                tickets[i].isValid = false;
                _burn(i);

                // Refund the ticket price to the owner
                if (refundAmount > 0) {
                    (bool success, ) = ticketOwner.call{value: refundAmount}("");
                    if (success) {
                        emit TicketRefunded(i, ticketOwner, refundAmount);
                    } else {
                        // If refund fails, add it to pendingWithdrawals
                        pendingWithdrawals[ticketOwner] += refundAmount;
                    }
                }
            }
        }
    }

    function withdrawFunds() public onlyOwner nonReentrant {
        require(
            !isCancelled,
            "Cannot withdraw funds if the event is cancelled."
        );
        require(
            block.timestamp > eventDate,
            "Cannot withdraw funds before the event date."
        );

        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw.");

        // Transfer the funds to the organizer
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed.");
    }

    // Example of an external function
    function getEventDetails()
        external
        view
        returns (
            uint256,
            string memory,
            string memory,
            uint256,
            uint256,
            uint256,
            address
        )
    {
        return (
            eventId,
            eventName,
            eventLocation,
            eventDate,
            ticketPriceUSD,
            ticketsAvailable,
            owner()
        );
    }

    // Example of a pure function
    function calculateServiceFee(
        uint256 _amount
    ) private pure returns (uint256) {
        // We chose a 2% service fee
        return (_amount * 2) / 100;
    }
}