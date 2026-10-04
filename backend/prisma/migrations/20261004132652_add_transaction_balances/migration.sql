-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receiverBalanceAfter" DECIMAL(19,4),
ADD COLUMN     "receiverBalanceBefore" DECIMAL(19,4),
ADD COLUMN     "senderBalanceAfter" DECIMAL(19,4),
ADD COLUMN     "senderBalanceBefore" DECIMAL(19,4);
