// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "XiaoYan",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "XiaoYan", targets: ["XiaoYan"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "XiaoYan",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            path: "Sources/XiaoYan",
            resources: [
                .copy("Data/journal_partitions.json"),
                .copy("Data/ccf_catalog.json"),
                .copy("Resources/friend-link-icons"),
                .copy("Resources/brand-logos"),
            ]
        )
    ]
)
