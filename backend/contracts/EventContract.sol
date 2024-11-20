// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importuri necesare
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract EventContract is ERC721 {
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

    // Mapping pentru bilete
    mapping(uint256 => Ticket) public tickets;
    uint256 public nextTicketId;

    // Chainlink Price Feed
    AggregatorV3Interface internal priceFeed;

    // Evenimente
    event TicketPurchased(uint256 indexed ticketId, address indexed buyer);
    event TicketTransferred(
        uint256 indexed ticketId,
        address indexed from,
        address indexed to
    );

    // Modificatori
    modifier onlyOrganizer() {
        require(
            msg.sender == organizer,
            "Doar organizatorul poate apela aceasta functie."
        );
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
        address _priceFeedAddress // Adresa Price Feed-ului Chainlink
    ) ERC721(_eventName, "TKT") {
        eventId = _eventId;
        eventName = _eventName;
        eventLocation = _eventLocation;
        eventDate = _eventDate;
        ticketPriceUSD = _ticketPriceUSD;
        ticketsAvailable = _ticketsAvailable;
        organizer = _organizer;
        nextTicketId = 1;

        // Initializarea Chainlink Price Feed
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    // Functie pentru a obtine pretul actual ETH/USD
    function getLatestPrice() public view returns (int) {
        (, int price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    // Functie pentru a calcula pretul biletului in Wei
    function getTicketPriceInWei() public view returns (uint256) {
        int ethPrice = getLatestPrice(); // Pretul ETH in USD cu 8 zecimale
        require(ethPrice > 0, "Pretul ETH nu este valid.");

        uint256 adjustedPrice = uint256(ethPrice) / 1e8; // Ajustam pretul la 18 zecimale

        uint256 priceInWei = (ticketPriceUSD * 1e18) / adjustedPrice; // Calculam pretul biletului in Wei

        return priceInWei;
    }

    // Functie pentru a cumpara un bilet
    function buyTicket() public payable {
        require(ticketsAvailable > 0, "Nu mai sunt bilete disponibile.");
        uint256 ticketPriceInWei = getTicketPriceInWei();
        require(
            msg.value >= ticketPriceInWei,
            "Valoarea trimisa nu este suficienta pentru a cumpara un bilet."
        );

        // Transferul sumei catre organizator
        organizer.transfer(msg.value);

        // Crearea biletului
        _safeMint(msg.sender, nextTicketId);
        emit TicketPurchased(nextTicketId, msg.sender);

        nextTicketId++;
        ticketsAvailable--;
    }

    // Functie pentru a transfera un bilet catre alta adresa
    function transferTicket(uint256 _ticketId, address _to) public {
        require(ownerOf(_ticketId) == msg.sender, "Nu detineti acest bilet.");
        _transfer(msg.sender, _to, _ticketId);
        emit TicketTransferred(_ticketId, msg.sender, _to);
    }

    // Functie pentru a invalida un bilet
    function invalidateTicket(uint256 _ticketId) public onlyOrganizer {
        _burn(_ticketId);
    }
}
