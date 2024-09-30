# 📷 Pix-Veil

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](#)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)

**Pix-Veil** is a tiny, yet powerful, command-line tool for steganography in PNG images. 
It allows you to hide files within PNG images securely using advanced Least Significant Bit (LSB) embedding, 
coupled with encryption and compression for enhanced security and efficiency.

---

## 🌟 Features

- **Advanced LSB Embedding**: Hide data within the least significant bits of PNG images using customizable parameters.
- **Strong Encryption**: Secure your data with AES-256-CBC encryption.
- **Compression**: Reduce data size with Brotli compression before embedding.
- **Data Chunking and Distribution**: Split data into chunks and distribute them across multiple images.
- **Encrypted Distribution Map**: Keep track of data chunks with an encrypted distribution map embedded within an image.
- **Image Capacity Analysis**: Analyze images for optimal data embedding based on tonal capacity.
- **Debugging Tools**: Enable verbose logging and debug visuals for development and troubleshooting.
- **Cross-Platform**: Compatible with Windows, macOS, and Linux.

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Usage](#️-usage)
    - [Encoding](#encoding)
    - [Decoding](#decoding)
- [Techniques Explained](#-techniques-explained)
    - [Least Significant Bit (LSB) Steganography](#least-significant-bit-lsb-steganography)
        - [LSB Embedding Process](#lsb-embedding-process)
        - [Mermaid Flowchart of LSB Embedding](#mermaid-flowchart-of-lsb-embedding)
        - [LSB Manipulation Illustration](#lsb-manipulation-illustration)
    - [Data Encryption](#data-encryption)
        - [Mermaid Flowchart of Data Encryption](#mermaid-flowchart-of-data-encryption)
    - [Data Compression](#data-compression)
        - [Mermaid Flowchart of Data Compression](#mermaid-flowchart-of-data-compression)
    - [Data Chunking and Distribution](#data-chunking-and-distribution)
        - [Distribution Map](#distribution-map)
        - [Mermaid Flowchart of Data Chunking and Distribution](#mermaid-flowchart-of-data-chunking-and-distribution)
        - [Mermaid Diagram of Distribution Map Embedding](#mermaid-diagram-of-distribution-map-embedding)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Installation

~~~bash
# Clone the repository
git clone https://github.com/slippyex/pix-veil.git

# Navigate to the project directory
cd pix-veil

# Install dependencies
yarn install

# Build the project
yarn compile

~~~

---

## 🛠️ Usage

Pix-Veil provides a command-line interface with two primary commands: `encode` and `decode`.

### Encoding

To hide a file within PNG images:

~~~bash
pix-veil encode \
  -i path/to/secret.file \
  -p path/to/png/folder \
  -o path/to/output/folder \
  -w yourpassword \
  --verbose
~~~

**Options:**

- `-i, --input <file>`: Input file to hide.
- `-p, --png-folder <folder>`: Folder containing PNG images to use.
- `-o, --output <folder>`: Output folder to store the modified images.
- `-w, --password <password>`: Password for encryption.
- `--verbose`: Enable verbose logging.
- `--debug-visual`: Enable debug visual blocks in images.

### Decoding

To extract the hidden file from PNG images:

~~~bash
pix-veil decode \
  -i path/to/encoded/png/folder \
  -o path/to/output/folder \
  -w yourpassword \
  --verbose
~~~

**Options:**

- `-i, --input <folder>`: Input folder containing the modified PNG images.
- `-o, --output <folder>`: Output folder to save the extracted file.
- `-w, --password <password>`: Password used during encoding.
- `--verbose`: Enable verbose logging.

---

## 🔍 Techniques Explained

### Least Significant Bit (LSB) Steganography

LSB steganography involves modifying the least significant bits of image pixel values to embed hidden data without significantly altering the image appearance.

#### LSB Embedding Process

- **Data Preparation**: The secret data is compressed and encrypted.
- **Data Splitting**: The encrypted data is split into chunks.
- **Image Analysis**: PNG images are analyzed for embedding capacity based on tonal values.
- **Data Embedding**: Data chunks are embedded into the images using LSB manipulation.

#### Mermaid Flowchart of LSB Embedding

~~~mermaid
flowchart TD
    A[Start Encoding Process] --> B[Read Input File]
    B --> C[Compress Data]
    C --> D[Encrypt Data with Password]
    D --> E[Split Encrypted Data into Chunks]
    E --> F[Read PNG Images from Folder]
    F --> G[Analyze Image Capacities]
    G --> H{Is Capacity Sufficient?}
    H -- No --> I[Error: Insufficient Capacity]
    H -- Yes --> J[Distribute Chunks Across Images]
    J --> K[Generate Distribution Map]
    K --> L[Encrypt and Compress Distribution Map]
    L --> M[Embed Chunks into Images using LSB]
    M --> N[Embed Distribution Map into Carrier Image]
    N --> O[Save Modified Images to Output Folder]
    O --> P[End Encoding Process]
~~~

#### LSB Manipulation Illustration

Here's a detailed illustration of how LSB manipulation works when embedding the byte `0xDE` into pixels, using a channel sequence of `RGB` and `2` bits per channel.

**Byte to Embed**: `0xDE` (binary `1101 1110`)

**Splitting into 2-bit groups**:

- Group 1: `11`
- Group 2: `01`
- Group 3: `11`
- Group 4: `10`

**Embedding Process**:

~~~mermaid
graph LR
    subgraph "Byte to Embed (0xDE)"
    B1["Bits: 11"]
    B2["Bits: 01"]
    B3["Bits: 11"]
    B4["Bits: 10"]
    end

    subgraph "Original Pixel Channels"
    R1["R1: 1001 1010"]
    G1["G1: 0110 1011"]
    B1_orig["B1: 1110 0101"]
    R2["R2: 1010 1100"]
    end

    B1 -- "Embed into LSBs" --> R1
    B2 -- "Embed into LSBs" --> G1
    B3 -- "Embed into LSBs" --> B1_orig
    B4 -- "Embed into LSBs" --> R2

    subgraph "Modified Pixel Channels"
    R1_mod["R1: 1001 10**11**"]
    G1_mod["G1: 0110 10**01**"]
    B1_mod["B1: 1110 01**11**"]
    R2_mod["R2: 1010 11**10**"]
    end

    R1 --> R1_mod
    G1 --> G1_mod
    B1_orig --> B1_mod
    R2 --> R2_mod
~~~

**Explanation**:

- **Original Pixel Channels**: The original binary values of the pixel channels.
- **Bits to Embed**: The 2-bit groups from the byte `0xDE`.
- **Embedding**: Each 2-bit group is embedded into the least significant bits (LSBs) of the channels, following the channel sequence `RGB`.
- **Modified Pixel Channels**: The new binary values of the channels after embedding.

**Details**:

- **R1**:
    - Original: `1001 1010`
    - Embed `11` into LSBs:
        - Replace last 2 bits with `11`: `1001 10**11**`
- **G1**:
    - Original: `0110 1011`
    - Embed `01` into LSBs:
        - Replace last 2 bits with `01`: `0110 10**01**`
- **B1**:
    - Original: `1110 0101`
    - Embed `11` into LSBs:
        - Replace last 2 bits with `11`: `1110 01**11**`
- **R2**:
    - Original: `1010 1100`
    - Embed `10` into LSBs:
        - Replace last 2 bits with `10`: `1010 11**10**`

---

### Data Encryption

- **Algorithm**: AES-256-CBC.
- **Purpose**: Ensures that even if the embedded data is extracted, it cannot be read without the correct password.
- **Process**:
    - Generate a 256-bit key from the password using SHA-256.
    - Encrypt the compressed data with the generated key.
    - Prepend a random Initialization Vector (IV) to the encrypted data.

---

### Data Compression

- **Algorithm**: Brotli Compression.
- **Purpose**: Reduces the size of the data to minimize the impact on the carrier images.
- **Benefits**:
    - Less data to embed leads to less modification of the images.
    - Improves security by obfuscating the data patterns.

---

### Data Chunking and Distribution

- **Chunking**: The encrypted data is split into multiple chunks of variable sizes.
- **Distribution**: Chunks are randomly distributed across different images and positions.
- **Benefits**:
    - Increases security by scattering data.
    - Balances the load across multiple images to minimize distortion.

#### Distribution Map

- **Purpose**: Keeps track of where each data chunk is embedded.
- **Security**:
    - The distribution map is compressed and encrypted.
    - Embedded within one of the images using LSB.
- **Components**:
    - Chunk IDs.
    - Corresponding image filenames.
    - Start and end positions.
    - Bits per channel and channel sequence used.

#### Mermaid Flowchart of Data Chunking and Distribution

~~~mermaid
flowchart TD
    A[Start Data Chunking] --> B[Encrypted Data]
    B --> C[Determine Chunk Sizes]
    C --> D[Split Data into Chunks]
    D --> E[Analyze Image Capacities]
    E --> F{Enough Capacity for Chunks?}
    F -- No --> G[Error: Insufficient Capacity]
    F -- Yes --> H[Assign Chunks to Images]
    H --> I[Record Assignments in Distribution Map]
    I --> J[Encrypt and Compress Distribution Map]
    J --> K[End Data Chunking]
~~~

#### Mermaid Diagram of Distribution Map Embedding

~~~mermaid
sequenceDiagram
    participant Encoder
    participant DistributionMap
    participant CarrierImage

    Encoder->>DistributionMap: Create Map of Chunk Locations
    Encoder->>DistributionMap: Encrypt and Compress Map
    Encoder->>CarrierImage: Embed Distribution Map using LSB
    CarrierImage->>Encoder: Distribution Map Embedded
    Encoder->>User: Save Carrier Image with Embedded Map
~~~

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [slippyex](https://github.com/slippyex)

---

## 📝 Additional Notes

- **Dependencies**:
    - Deno v2 RC and yarn.
    - Sharp library for image processing.
    - Commander for CLI interface.
    - Inquirer for password prompt
    - Figlet for a fancy ASCII art logo
- **Security Considerations**:
    - Ensure that the password used is strong and kept confidential.
    - Be aware of the legal implications of steganography in your jurisdiction.

---

# Acknowledgments

- Icons made by [Freepik](https://www.freepik.com) from [www.flaticon.com](https://www.flaticon.com).
- Inspired by various steganography techniques and tools.

---

[![ForTheBadge built-with-love](http://ForTheBadge.com/images/badges/built-with-love.svg)](#)
