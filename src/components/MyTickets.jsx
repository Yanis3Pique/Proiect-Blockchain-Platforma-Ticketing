import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import EventContractJSON from '../abis/EventContract.json';
import TicketingPlatform from '../abis/TicketingPlatform.json';

const MyTickets = () => {
    const { account, library } = useWeb3React();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transferringTickets, setTransferringTickets] = useState({});
    const [claimingRefunds, setClaimingRefunds] = useState({});

    const fetchTickets = async () => {
        if (!account || !library) return;

        try {
            const provider = library;
            const ticketingPlatformAddress = import.meta.env.VITE_TICKETING_PLATFORM_ADDRESS;
            const platformContract = new ethers.Contract(ticketingPlatformAddress, TicketingPlatform.abi, provider);

            const nextEventIdBN = await platformContract.nextEventId();
            const nextEventId = nextEventIdBN.toNumber();

            const eventAddresses = [];
            for (let eventId = 0; eventId < nextEventId; eventId++) {
                const eventAddress = await platformContract.getEventAddress(eventId);
                eventAddresses.push(eventAddress);
            }

            const fetchedTickets = [];

            for (const eventAddress of eventAddresses) {
                const eventContract = new ethers.Contract(eventAddress, EventContractJSON.abi, provider);

                let eventDetails;
                try {
                    eventDetails = await eventContract.getEventDetails();
                } catch (error) {
                    console.error(`Error fetching event details for event at ${eventAddress}:`, error);
                    continue;
                }

                const [
                    ,
                    eventName,
                    eventLocation,
                    eventDateBN,
                    ticketPriceUSDBN,
                    ,
                    ,
                    isCancelled
                ] = eventDetails;

                const eventDateTimestamp = eventDateBN.toNumber() * 1000;

                let ticketIdsBN;
                try {
                    ticketIdsBN = await eventContract.getTicketsOfOwner(account);
                } catch (error) {
                    console.error(`Error fetching tickets for owner at event ${eventAddress}:`, error);
                    continue;
                }

                const ticketIds = ticketIdsBN.map(id => id.toNumber());

                for (const ticketId of ticketIds) {
                    const ticketDetails = await eventContract.getTicketDetails(ticketId);
                    const [, , isValid, refundable] = ticketDetails;

                    const ticket = {
                        ticketId: ticketId,
                        eventAddress: eventAddress,
                        eventName,
                        eventLocation,
                        eventDate: new Date(eventDateTimestamp),
                        eventDateTimestamp: eventDateTimestamp,
                        eventDateString: new Date(eventDateTimestamp).toLocaleString(),
                        ticketPriceUSD: ticketPriceUSDBN.toNumber(),
                        isCancelled,
                        isValid,
                        isRefundable: refundable
                    };

                    fetchedTickets.push(ticket);
                }
            }

            setTickets(fetchedTickets);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [account, library]);

    const handleTransferTicket = async (ticket) => {
        const recipientAddress = prompt('Enter the recipient\'s address:');
        if (!recipientAddress) return;

        if (!ethers.utils.isAddress(recipientAddress)) {
            alert('Invalid address.');
            return;
        }

        try {
            setTransferringTickets((prevState) => ({
                ...prevState,
                [ticket.ticketId]: true,
            }));
            const provider = library;
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(ticket.eventAddress, EventContractJSON.abi, signer);

            const gasEstimate = await eventContract.estimateGas.transferTicket(ticket.ticketId, recipientAddress);
            const tx = await eventContract.transferTicket(ticket.ticketId, recipientAddress, {
                gasLimit: gasEstimate.mul(110).div(100),
            });

            await tx.wait();

            alert('Ticket transferred successfully!');

            await fetchTickets();
        } catch (error) {
            console.error('Error transferring ticket:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error transferring ticket: ${error.message || error}`);
            }
        } finally {
            setTransferringTickets((prevState) => ({
                ...prevState,
                [ticket.ticketId]: false,
            }));
        }
    };

    const handleClaimRefund = async (ticket) => {
        try {
            setClaimingRefunds((prevState) => ({
                ...prevState,
                [ticket.ticketId]: true,
            }));
            const provider = library;
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(ticket.eventAddress, EventContractJSON.abi, signer);

            const tx = await eventContract.claimRefund(ticket.ticketId);
            await tx.wait();

            alert('Refund claimed successfully!');
            await fetchTickets();
        } catch (error) {
            console.error('Error claiming refund:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error claiming refund: ${error.message || error}`);
            }
        } finally {
            setClaimingRefunds((prevState) => ({
                ...prevState,
                [ticket.ticketId]: false,
            }));
        }
    };

    if (loading) {
        return <div>Loading your tickets...</div>;
    }

    if (tickets.length === 0) {
        return <div>You have no tickets.</div>;
    }

    return (
        <div>
            <h2 className="text-2xl mb-4">My Tickets</h2>
            {tickets.map((ticket, index) => {
                // Adaugam 30 de minute la eventDate-ul evenimentului
                const isEventDatePassed = Date.now() > ticket.eventDateTimestamp + 30 * 60 * 1000;
                console.log('isEventDatePassed', isEventDatePassed);
                console.log('ticket', ticket);
                console.log(Date.now(), '>' , ticket.eventDateTimestamp + 30 * 60 * 1000);

                return (
                    <div key={index} className="border p-4 mb-4 rounded">
                        <h3>{ticket.eventName}</h3>
                        <p>Ticket ID: {ticket.ticketId}</p>
                        <p>Event Date: {ticket.eventDateString}</p>
                        <p>Location: {ticket.eventLocation}</p>
                        {ticket.isCancelled && ticket.isRefundable ? (
                            <button
                                className="mt-2 bg-red-500 text-white p-2 rounded disabled:opacity-50"
                                onClick={() => handleClaimRefund(ticket)}
                                disabled={claimingRefunds[ticket.ticketId]}
                            >
                                {claimingRefunds[ticket.ticketId] ? 'Claiming Refund...' : 'Claim Refund'}
                            </button>
                        ) : !isEventDatePassed && ticket.isValid ? (
                            <button
                                className="mt-2 bg-blue-500 text-white p-2 rounded disabled:opacity-50"
                                onClick={() => handleTransferTicket(ticket)}
                                disabled={transferringTickets[ticket.ticketId]}
                            >
                                {transferringTickets[ticket.ticketId] ? 'Transferring...' : 'Transfer Ticket'}
                            </button>
                        ) : (
                            <p className="text-gray-500">Ticket is no longer valid.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MyTickets;
