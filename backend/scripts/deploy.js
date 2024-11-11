async function main() {
    // Obține semnătura contului cu care vei implementa contractul
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Obține instanța contractului Ticketing
    const Ticketing = await ethers.getContractFactory("Ticketing");
    
    // Implementare contract pe blockchain
    const ticketing = await Ticketing.deploy();
    
    // Așteaptă să se finalizeze implementarea
    await ticketing.deployed();

    console.log("Ticketing contract deployed to address:", ticketing.address);
}

// Rulează funcția principală și gestionează eventualele erori
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
