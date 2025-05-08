# Use the official PHP 8.1 image with Apache
FROM php:8.1-apache

# Update and install required packages
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install zip pdo pdo_mysql

# Enable Apache mod_rewrite (for pretty URLs)
RUN a2enmod rewrite

# Copy application files
COPY . /var/www/html/

# Set proper permissions (adjust as needed for your app)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# The default command from php:8.1-apache will run Apache in foreground
# No need to specify CMD as it inherits the parent image's CMD
