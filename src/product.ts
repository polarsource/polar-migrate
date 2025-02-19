import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import {
	type ListProducts,
	type ListVariants,
	listFiles,
} from "@lemonsqueezy/lemonsqueezy.js";
import type { Polar } from "@polar-sh/sdk";
import type { Timeframe } from "@polar-sh/sdk/models/components/benefitlicensekeyexpirationproperties.js";
import type { BenefitLicenseKeyExpirationProperties } from "@polar-sh/sdk/models/components/benefitlicensekeyexpirationproperties.js";
import type { FileRead } from "@polar-sh/sdk/models/components/listresourcefileread.js";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { ProductCreate } from "@polar-sh/sdk/models/components/productcreate.js";
import type { ProductPriceCustomCreate } from "@polar-sh/sdk/models/components/productpricecustomcreate.js";
import type { ProductPriceFixedCreate } from "@polar-sh/sdk/models/components/productpricefixedcreate.js";
import type { ProductPriceFreeCreate } from "@polar-sh/sdk/models/components/productpricefreecreate.js";
import type { SubscriptionRecurringInterval } from "@polar-sh/sdk/models/components/subscriptionrecurringinterval.js";
import mime from "mime-types";
import { uploadFailedMessage, uploadMessage } from "./ui/upload.js";
import { Upload } from "./upload.js";

const resolveInterval = (
	interval: ListVariants["data"][number]["attributes"]["interval"],
): SubscriptionRecurringInterval | null => {
	switch (interval) {
		case "month":
			return "month";
		case "year":
			return "year";
		default:
			return null;
	}
};

const resolvePrice = (
	variant: ListVariants["data"][number],
):
	| ProductPriceFixedCreate
	| ProductPriceFreeCreate
	| ProductPriceCustomCreate => {
	const priceCurrency = "usd";
	const priceAmount = variant.attributes.price;

	if (priceAmount > 0) {
		return {
			amountType: "fixed",
			priceAmount,
			priceCurrency,
		};
	}

	const payWhatYouWant = variant.attributes.pay_what_you_want;

	if (payWhatYouWant) {
		return {
			amountType: "custom",
			priceAmount,
			priceCurrency,
			minimumAmount:
				variant.attributes.min_price < 50 ? 50 : variant.attributes.min_price,
			presetAmount: variant.attributes.suggested_price,
		} as ProductPriceCustomCreate;
	}

	if (priceAmount > 0) {
		return {
			amountType: "fixed",
			priceAmount,
			priceCurrency,
		} as ProductPriceFixedCreate;
	}

	return {
		amountType: "free",
	};
};

const resolveLicenseKeyExpiration = (
	variant: ListVariants["data"][number],
): BenefitLicenseKeyExpirationProperties => {
	let timeframe: Timeframe;

	switch (variant.attributes.license_length_unit) {
		case "days":
			timeframe = "day";
			break;
		case "months":
			timeframe = "month";
			break;
		case "years":
			timeframe = "year";
			break;
	}

	return {
		timeframe,
		ttl: variant.attributes.license_length_value,
	};
};

export const createProduct = async (
	api: Polar,
	organization: Organization,
	variant: ListVariants["data"][number],
	lemonProduct: ListProducts["data"][number],
) => {
	const price = resolvePrice(variant);
	const isDefault = variant.attributes.name === "Default";

	const productName = isDefault
		? (lemonProduct?.attributes.name ?? variant.attributes.name)
		: `${lemonProduct?.attributes.name} - ${variant.attributes.name}`;

	const description = isDefault
		? lemonProduct?.attributes.description
		: variant.attributes.description;

	// Split creation based on price type
	const createParams: ProductCreate = {
		name: productName,
		prices: [price],
		recurringInterval: variant.attributes.is_subscription
			? resolveInterval(variant.attributes.interval)
			: null,
		description: description,
		organizationId: organization.id,
	};

	const product = await api.products.create(createParams);

	if (variant.attributes.has_license_keys) {
		const benefit = await api.benefits.create({
			type: "license_keys",
			description: `${productName.slice(0, 28)} License Key`,
			properties: {
				expires: variant.attributes.is_license_length_unlimited
					? undefined
					: resolveLicenseKeyExpiration(variant),
				activations: variant.attributes.is_license_limit_unlimited
					? undefined
					: {
							limit: variant.attributes.license_activation_limit,
							enableCustomerAdmin: true,
						},
			},
			organizationId: organization.id,
		});

		await api.products.updateBenefits({
			id: product.id,
			productBenefitsUpdate: {
				benefits: [benefit.id],
			},
		});
	}

	try {
		await handleFiles(api, organization, variant, product);
	} catch (e) {
		await uploadFailedMessage();
	}

	return {
		variantId: variant.id,
		product,
	};
};

const handleFiles = async (
	api: Polar,
	organization: Organization,
	variant: ListVariants["data"][number],
	product: Product,
) => {
	const files = await listFiles({
		filter: {
			variantId: variant.id,
		},
	});

	// Group files with same variant id and download them
	const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "polar-"));

	const groupedFiles =
		files.data?.data?.reduce<
			Record<string, { downloadUrl: string; filePath: string }[]>
		>((acc, file) => {
			if ("attributes" in file && "variant_id" in file.attributes) {
				const filePath = path.join(tempDir, file.attributes.name);
				const url = new URL(file.attributes.download_url);

				acc[file.attributes.variant_id] = [
					...(acc[file.attributes.variant_id] ?? []),
					{
						downloadUrl: url.toString(),
						filePath,
					},
				];
			}

			return acc;
		}, {}) ?? {};

	await Promise.all(
		Object.values(groupedFiles)
			.flat()
			.map((file) => downloadFile(file.downloadUrl, file.filePath)),
	);

	// Create one benefit per variant, upload the files to the benefit, and add the benefit to the product

	for (const [_, files] of Object.entries(groupedFiles)) {
		const fileUploads = await Promise.all(
			files.map((file) => uploadFile(api, organization, file.filePath)),
		);

		const benefit = await api.benefits.create({
			type: "downloadables",
			description: product.name,
			properties: {
				files: fileUploads.map((file) => file.id),
			},
			organizationId: organization.id,
		});

		await api.products.updateBenefits({
			id: product.id,
			productBenefitsUpdate: {
				benefits: [benefit.id],
			},
		});
	}

	// Clean up temporary files
	await Promise.all(
		Object.values(groupedFiles)
			.flat()
			.map((file) => fs.promises.unlink(file.filePath)),
	);

	await fs.promises.rmdir(tempDir);
};

const downloadFile = (url: string, filePath: string) => {
	return new Promise<void>((resolve, reject) => {
		const options = {
			method: "GET",
			headers: {
				"Content-Type": "application/octet-stream",
			},
		};

		const writer = fs.createWriteStream(filePath);

		const request = https.get(url, options, (response) => {
			if (response.statusCode !== 200) {
				fs.unlink(filePath, (e) => {
					if (e) {
						console.error(e);
					}
				});
				reject(response);
				return;
			}

			response.pipe(writer);

			writer.on("finish", () => {
				writer.close();
				resolve();
			});
		});

		request.on("error", (err) => {
			console.error(err);

			fs.unlink(filePath, (e) => {
				if (e) {
					console.error(e);
				}
			});
		});

		writer.on("error", (err) => {
			console.error(err);

			fs.unlink(filePath, (e) => {
				if (e) {
					console.error(e);
				}
			});
		});

		request.end();
	});
};

const uploadFile = async (
	api: Polar,
	organization: Organization,
	filePath: string,
) => {
	const readStream = fs.createReadStream(filePath);
	const mimeType = mime.lookup(filePath) || "application/octet-stream";

	const fileUploadPromise = new Promise<FileRead>((resolve) => {
		const upload = new Upload(api, {
			organization,
			file: {
				name: path.basename(filePath),
				type: mimeType,
				size: fs.statSync(filePath).size,
				readStream,
			},
			onFileUploadProgress: () => {},
			onFileUploaded: resolve,
		});

		upload.run();
	});

	await uploadMessage(fileUploadPromise);

	const fileUpload = await fileUploadPromise;

	return fileUpload;
};
