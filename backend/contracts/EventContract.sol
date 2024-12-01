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
    }

    uint256 public eventId;
    string public eventName;
    string public eventLocation;
    uint256 public eventDate;
    uint256 public ticketPriceUSD;
    uint256 public ticketsAvailable;
    address payable public organizer;
    uint256 public nextTicketId;
    bool public isCancelled;
    address payable public platform;

    mapping(uint256 => Ticket) public tickets;

    mapping(uint256 => uint256) public ticketPricesPaid;

    mapping(address => uint256) public pendingWithdrawals;

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
        platform = _platform;

        priceFeed = AggregatorV3Interface(_priceFeedAddress);

        transferOwnership(_organizer);
    }

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
                isValid: true
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
        isCancelled = true;

        refundAllTickets();

        emit EventCancelled();
    }

    function refundAllTickets() private {
        for (uint256 i = 1; i < nextTicketId; i++) {
            if (tickets[i].isValid) {
                address payable ticketOwner = payable(tickets[i].owner);
                uint256 refundAmount = ticketPricesPaid[i];

                tickets[i].isValid = false;
                _burn(i);

                if (refundAmount > 0) {
                    (bool success, ) = ticketOwner.call{value: refundAmount}(
                        ""
                    );
                    if (success) {
                        emit TicketRefunded(i, ticketOwner, refundAmount);
                    } else {
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

        (bool success, ) = msg.sender.call{value: amount}("");
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
            isCancelled
        );
    }

    function calculateServiceFee(
        uint256 _amount
    ) private pure returns (uint256) {
        return (_amount * 2) / 100;
    }
}
