-- --------------------------------------------------------
-- 호스트:                          192.168.1.20
-- 서버 버전:                        10.3.39-MariaDB-0ubuntu0.20.04.2 - Ubuntu 20.04
-- 서버 OS:                        debian-linux-gnu
-- HeidiSQL 버전:                  12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- 테이블 ipforce.USER_INFO_TB 구조 내보내기
CREATE TABLE IF NOT EXISTS `USER_INFO_TB` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `email` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `certification` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `email_verification_code` varchar(6) DEFAULT NULL,
  `email_verification_expires_at` datetime DEFAULT NULL,
  `phone_verification_code` varchar(6) DEFAULT NULL,
  `phone_verification_expires_at` datetime DEFAULT NULL,
  `created_datetime` datetime NOT NULL,
  `updated_datetime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 ipforce.USER_INFO_TB:~4 rows (대략적) 내보내기
INSERT INTO `USER_INFO_TB` (`id`, `name`, `email`, `password`, `certification`, `email_verification_code`, `email_verification_expires_at`, `phone_verification_code`, `phone_verification_expires_at`, `created_datetime`, `updated_datetime`) VALUES
	(1, 'ipforce', 'ipforce@ipforce.co.kr', '$2b$12$Mq6r9q50seSyJJMmrgTMveGk7eK/UphZAusa/q7XVMamkjUPtX5QK', 'APPROVED', '', '2024-08-02 16:27:16', '', NULL, '2024-08-02 16:27:16', '2024-08-02 16:27:16'),
	(2, '삼성배터리 김영일', 'youngeal@samsung.com', '$2b$12$UlZYLY2aYsuBMKV7ITdO7.yZz7U7HU48ZRP14o/Xqb3V0qAzvlqzO', 'APPROVED', 'H2ZOEK', '2025-02-04 09:39:36', NULL, NULL, '2025-02-04 09:39:34', '2025-02-04 09:39:35'),
	(3, '서울대학교 김희영 ', 'qwaszx6745@snu.ac.kr', '$2b$12$Ox0zIz0vmzZ9wdrGdzqYwexwUBmkI/9mfRBzCUFmywQdOFDeH2dl6', 'APPROVED', '8IAZL3', '2025-02-11 00:50:39', NULL, NULL, '2025-02-11 00:50:39', '2025-02-11 00:50:39'),
	(18, '김예찬', 'af.yckim@gmail.com', '$2b$12$Eruvq4jqf2nqKVamZSIut.2YF5m1p3G9b.FHXW9ySZ.A3XXA57pk6', 'APPROVED', NULL, NULL, NULL, NULL, '2025-09-02 07:36:11', '2025-09-02 07:36:11');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
