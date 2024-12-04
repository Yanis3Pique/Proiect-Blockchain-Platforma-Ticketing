// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EventContract.sol";

contract TicketingPlatform {
    uint256 public nextEventId;

    // Mapping care asociază ID-ul unui eveniment cu adresa contractului corespunzator
    mapping(uint256 => address) public events;

    event EventCreated(
        uint256 indexed eventId,
        address indexed eventAddress,
        address indexed organizer
    );

    // Adresa contractului Chainlink Price Feed utilizat pentru obtinerea pretului ETH/USD
    address public priceFeedAddress;

    constructor(address _priceFeedAddress) {
        priceFeedAddress = _priceFeedAddress;
    }

    function createEvent(
        string memory _eventName,
        string memory _eventLocation,
        uint256 _eventDate,
        uint256 _ticketPriceUSD,
        uint256 _ticketsAvailable
    ) public {
        require(
            _eventDate > block.timestamp,
            "Event date must be in the future."
        );
        require(
            _ticketsAvailable > 0,
            "There must be at least one ticket available."
        );

        EventContract newEvent = new EventContract(
            nextEventId,
            _eventName,
            _eventLocation,
            _eventDate,
            _ticketPriceUSD,
            _ticketsAvailable,
            payable(msg.sender),
            priceFeedAddress,
            payable(msg.sender)
        );

        // Salvam adresa noului eveniment in mapping-ul events
        events[nextEventId] = address(newEvent);
        emit EventCreated(nextEventId, address(newEvent), msg.sender);

        nextEventId++;
    }

    function getEventAddress(uint256 _eventId) public view returns (address) {
        return events[_eventId];
    }
}
