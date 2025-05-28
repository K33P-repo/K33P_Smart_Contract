# K33P Identity System Backend

This is the backend API for the K33P Decentralized Identity System, which provides authentication, UTXO management, and Zero-Knowledge Proof verification for the Cardano blockchain-based identity solution.

## Features

- User registration and authentication with JWT
- UTXO management for identity smart contracts
- Zero-Knowledge Proof generation and verification
- Integration with Cardano blockchain via Lucid SDK
- PostgreSQL database with Prisma ORM

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Cardano node or Blockfrost API access

## Setup

1. Clone the repository and navigate to the backend directory:

```bash
cd K33P_Smart_Contract/backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration values:

- Set `JWT_SECRET` to a secure random string
- Configure Blockfrost API key and URL
- Set the script hash and address for your deployed smart contract
- Configure your database connection string

5. Set up the database:

```bash
npx prisma migrate dev --name init
```

6. Seed the database with test data (optional):

```bash
npx prisma db seed
```

## Running the Server

Start the development server:

```bash
npm run dev
```

For production:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login with ZK proof
- `POST /api/auth/logout` - Logout (requires authentication)
- `GET /api/auth/me` - Get current user (requires authentication)

### UTXO Management

- `GET /api/utxo/fetch/:phoneHash` - Fetch UTXOs by phone hash (requires authentication)
- `POST /api/utxo/refund` - Issue a refund for a UTXO (requires authentication)
- `POST /api/utxo/track` - Track a new UTXO in the database (requires authentication)
- `GET /api/utxo/user` - Get all UTXOs for the current user (requires authentication)

### Zero-Knowledge Proofs

- `POST /api/zk/commitment` - Generate a ZK commitment
- `POST /api/zk/proof` - Generate a ZK proof
- `POST /api/zk/verify` - Verify a ZK proof
- `POST /api/zk/login` - Login with ZK proof
- `GET /api/zk/user/:userId` - Get user's ZK commitment (requires authentication)

## Development

### Database Management

View the database schema:

```bash
npx prisma studio
```

Reset the database:

```bash
npx prisma migrate reset
```

### Testing

Run tests:

```bash
npm test
```

## Integration with Smart Contract

The backend interacts with the Aiken smart contract through the Lucid SDK. The smart contract validator is defined in `validators/identity.ak` and handles two main operations:

1. **Signup**: Locks 2 ADA with user identity data in the datum
2. **Refund**: Allows the authorized backend to refund the stake

The backend provides APIs to create signup transactions and issue refunds, as well as to track UTXOs at the script address.

## Zero-Knowledge Proof Integration

The current implementation uses simulated ZK proofs. In a production environment, you would replace the placeholder functions in `src/utils/zk.js` with a real ZK library implementation.

## Security Considerations

- The backend private key should be kept secure and never exposed
- JWT tokens should have a reasonable expiration time
- All API endpoints should validate input data
- ZK proofs should be properly verified before granting access
- Database connections should be properly secured

## License

MIT