// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract EventContract is ERC721, Ownable, ReentrancyGuard {
    struct Ticket {
        uint256 ticketId;
        address owner;
        bool isValid;
        bool refundable;
    }

    uint256 public eventId;
    string public eventName;
    string public eventLocation;
    uint256 public eventDate; // Data in format UNIX
    uint256 public ticketPriceUSD;
    uint256 public ticketsAvailable;
    address payable public organizer;
    uint256 public nextTicketId;
    bool public isCancelled;
    address payable public platform;
    bool public fundsWithdrawn;

    // Mapping pentru bilete, preturi si retrageri
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256) public ticketPricesPaid;
    // mapping(address => uint256) public pendingWithdrawals;

    // Referinta pentru Chainlink Price Feed
    AggregatorV3Interface internal priceFeed;

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
    event FundsWithdrawn(uint256 amount);
    event TicketInvalidated(uint256 indexed ticketId);

    modifier onlyOrganizer() {
        require(
            msg.sender == organizer,
            "Doar organizatorul poate apela aceasta functie."
        );
        _;
    }

    modifier eventNotCancelled() {
        require(!isCancelled, "Event is cancelled.");
        _;
    }

    constructor(
        uint256 _eventId,
        string memory _eventName,
        string memory _eventLocation,
        uint256 _eventDate,
        uint256 _ticketPriceUSD,
        uint256 _ticketsAvailable,
        address payable _organizer,
        address _priceFeedAddress,
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
        fundsWithdrawn = false;
        platform = _platform;

        priceFeed = AggregatorV3Interface(_priceFeedAddress);

        transferOwnership(_organizer);
    }

    // Returneaza lista de bilete detinute de o anumita adresa
    function getTicketsOfOwner(
        address _owner
    ) external view returns (uint256[] memory) {
        uint256 totalTickets = nextTicketId - 1;
        uint256[] memory tempTickets = new uint256[](totalTickets);
        uint256 counter = 0;

        for (uint256 ticketId = 1; ticketId <= totalTickets; ticketId++) {
            if (
                tickets[ticketId].isValid && tickets[ticketId].owner == _owner
            ) {
                tempTickets[counter] = ticketId;
                counter++;
            }
        }

        uint256[] memory result = new uint256[](counter);
        for (uint256 i = 0; i < counter; i++) {
            result[i] = tempTickets[i];
        }

        return result;
    }

    // Obtine pretul ETH/USD folosind Chainlink
    function getLatestPrice() internal view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid ETH price.");
        return uint256(price);
    }

    function getTicketPriceInWei() public view returns (uint256) {
        uint256 ethPrice = getLatestPrice();
        require(ethPrice > 0, "Pretul ETH nu este valid.");

        uint256 priceInWei = (ticketPriceUSD * 1e26) / uint256(ethPrice);

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

        uint256 totalTicketPrice = ticketPriceInWei * _quantity;

        uint256 totalServiceFee = calculateServiceFee(totalTicketPrice);

        uint256 totalPriceWithFee = totalTicketPrice + totalServiceFee;

        require(
            msg.value >= totalPriceWithFee,
            "Insufficient funds to purchase tickets."
        );

        ticketsAvailable -= _quantity;

        (bool feeTransferSuccess, ) = platform.call{value: totalServiceFee}("");
        require(feeTransferSuccess, "Service fee transfer failed.");

        for (uint256 i = 0; i < _quantity; i++) {
            uint256 ticketId = nextTicketId;
            _safeMint(msg.sender, ticketId);

            tickets[ticketId] = Ticket({
                ticketId: ticketId,
                owner: msg.sender,
                isValid: true,
                refundable: false
            });

            ticketPricesPaid[ticketId] = ticketPriceInWei;

            emit TicketPurchased(ticketId, msg.sender);

            nextTicketId++;
        }

        uint256 excessPayment = msg.value - totalPriceWithFee;
        if (excessPayment > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excessPayment}("");
            require(refundSuccess, "Refund of excess payment failed.");
        }
    }

    function getTotalPriceWithFee(
        uint256 _quantity
    ) public view returns (uint256) {
        uint256 ticketPriceInWei = getTicketPriceInWei();
        uint256 totalTicketPrice = ticketPriceInWei * _quantity;
        uint256 totalServiceFee = calculateServiceFee(totalTicketPrice);
        uint256 totalPriceWithFee = totalTicketPrice + totalServiceFee;
        return totalPriceWithFee;
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
            require(
                block.timestamp < eventDate + 30 minutes,
                "Cannot invalidate tickets after 30 minutes after event date."
            );
            require(tickets[_ticketIds[i]].isValid, "Ticket is already invalid.");
            uint256 ticketId = _ticketIds[i];
            if (tickets[ticketId].isValid) {
                _burn(ticketId);
                tickets[ticketId].isValid = false;

                emit TicketInvalidated(ticketId);
            }
        }
    }

    function cancelEvent() public onlyOwner nonReentrant {
        require(!isCancelled, "Event is already cancelled.");
        require(!fundsWithdrawn, "Funds have already been withdrawn.");
        isCancelled = true;

        // Marcam toate biletele ca fiind refundabile
        for (uint256 i = 1; i < nextTicketId; i++) {
            if (tickets[i].isValid) {
                tickets[i].refundable = true;
            }
        }

        emit EventCancelled();
    }

    // Functie pentru ca userii sa poata primi refund pentru biletele cumparate
    function claimRefund(uint256 _ticketId) public nonReentrant {
        require(isCancelled, "Event is not cancelled.");
        require(tickets[_ticketId].owner == msg.sender, "You do not own this ticket.");
        require(tickets[_ticketId].refundable, "Refund already claimed or ticket not refundable.");

        uint256 refundAmount = ticketPricesPaid[_ticketId];
        require(refundAmount > 0, "No refund amount available.");

        tickets[_ticketId].refundable = false;
        tickets[_ticketId].isValid = false;
        _burn(_ticketId);

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund transfer failed.");

        emit TicketRefunded(_ticketId, msg.sender, refundAmount);
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
        (bool success, ) = msg.sender.call{value: amount}("");
        if (success) {
            console.log("Funds withdrawn: %s", amount);
            fundsWithdrawn = true;
            emit FundsWithdrawn(amount);
        }
        require(success, "Withdrawal failed.");
    }

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
            address,
            bool,
            bool
        )
    {
        return (
            eventId,
            eventName,
            eventLocation,
            eventDate,
            ticketPriceUSD,
            ticketsAvailable,
            owner(),
            isCancelled,
            fundsWithdrawn
        );
    }

    function getTicketDetails(uint256 _ticketId) external view returns (
        uint256 ticketId,
        address owner,
        bool isValid,
        bool refundable
    ) {
        Ticket memory ticket = tickets[_ticketId];
        return (
            ticket.ticketId,
            ticket.owner,
            ticket.isValid,
            ticket.refundable
        );
    }

    function calculateServiceFee(
        uint256 _amount
    ) private pure returns (uint256) {
        return (_amount * 2) / 100;
    }
}
