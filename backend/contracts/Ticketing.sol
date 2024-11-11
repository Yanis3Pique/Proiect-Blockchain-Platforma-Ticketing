// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ticketing {
    // Structura pentru un eveniment
    struct Event {
        string name;
        uint date;
        uint price;
        uint totalTickets;
        uint ticketsSold;
        address organizer;
    }

    // Map pentru stocarea evenimentelor
    mapping(uint => Event) public events;
    uint public eventCount;

    // Map pentru stocarea biletelor cumpărate de fiecare utilizator
    mapping(uint => mapping(address => uint)) public tickets;

    // Evenimente
    event EventCreated(uint eventId, string name, uint date, uint price, uint totalTickets, address organizer);
    event TicketPurchased(uint eventId, address buyer, uint quantity);

    // Modifier pentru a permite doar organizatorului să execute funcția
    modifier onlyOrganizer(uint _eventId) {
        require(events[_eventId].organizer == msg.sender, "Doar organizatorul poate executa aceasta functie");
        _;
    }

    // Funcția pentru a crea un nou eveniment
    function createEvent(string memory _name, uint _date, uint _price, uint _totalTickets) public {
        require(_date > block.timestamp, "Data evenimentului trebuie sa fie in viitor");
        require(_totalTickets > 0, "Trebuie sa existe cel putin un bilet disponibil");

        eventCount++;
        events[eventCount] = Event({
            name: _name,
            date: _date,
            price: _price,
            totalTickets: _totalTickets,
            ticketsSold: 0,
            organizer: msg.sender
        });

        emit EventCreated(eventCount, _name, _date, _price, _totalTickets, msg.sender);
    }

    // Funcția pentru a cumpăra bilete pentru un eveniment
    function buyTickets(uint _eventId, uint _quantity) external payable {
        Event storage _event = events[_eventId];
        
        require(_event.date > block.timestamp, "Evenimentul a avut loc deja");
        require(_quantity > 0, "Trebuie sa cumperi cel putin un bilet");
        require(_event.ticketsSold + _quantity <= _event.totalTickets, "Nu sunt suficiente bilete disponibile");
        require(msg.value == _quantity * _event.price, "Valoarea trimisa nu este corecta");

        _event.ticketsSold += _quantity;
        tickets[_eventId][msg.sender] += _quantity;

        emit TicketPurchased(_eventId, msg.sender, _quantity);
    }

    // Funcție pentru a verifica numărul de bilete deținute de o adresă pentru un eveniment
    function ticketsOf(uint _eventId, address _owner) external view returns (uint) {
        return tickets[_eventId][_owner];
    }

    // Funcție pentru ca organizatorul să retragă fondurile după încheierea evenimentului
    function withdrawFunds(uint _eventId) external onlyOrganizer(_eventId) {
        Event storage _event = events[_eventId];
        require(_event.date < block.timestamp, "Evenimentul nu a avut loc inca");

        uint balance = address(this).balance;
        payable(_event.organizer).transfer(balance);
    }
}
